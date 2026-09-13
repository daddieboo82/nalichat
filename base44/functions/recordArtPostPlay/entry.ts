import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import {
  acquireArtPostEngagementLock,
  releaseArtPostEngagementLock,
} from '../../shared/artPostEngagementLock.ts';

async function playId(postId: string, listenerId: string, day: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${postId}:${listenerId}:${day}`),
  );
  const suffix = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `art_post_play_${suffix}`;
}

export default async function(req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ counted: false, reason: 'anonymous' }, { status: 401 });
    }
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const body = await readJsonBodyLimited(req, 8 * 1024);
    const postId = typeof body?.post_id === 'string' ? body.post_id.trim() : '';
    if (!isBase44EntityId(postId)) {
      return Response.json({ error: 'post_id is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const playRate = await consumeHourlyLimit(
      entities,
      user.id,
      'art_post_play',
      600,
    );
    if (!playRate.allowed) {
      return Response.json({ error: 'Play tracking rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const postPreview = await entities.ArtPost.get(postId).catch(() => null);
    if (!postPreview) return Response.json({ error: 'Track not found' }, { status: 404 });
    if (postPreview.creator_id === user.id) {
      return Response.json({ success: true, action: 'record_art_post_play', userId: user.id, postId, counted: false, reason: 'creator_self_play', views: Number(postPreview.views || 0) });
    }

    const lockId = await acquireArtPostEngagementLock(entities, postId);
    if (!lockId) {
      return Response.json({ error: 'Post is being updated. Please retry.' }, { status: 409 });
    }

    try {
      const post = await entities.ArtPost.get(postId).catch(() => null);
      if (!post) return Response.json({ error: 'Track not found' }, { status: 404 });
      if (post.creator_id === user.id) {
        return Response.json({ success: true, action: 'record_art_post_play', userId: user.id, postId, counted: false, reason: 'creator_self_play', views: Number(post.views || 0) });
      }

    const day = new Date().toISOString().slice(0, 10);
    const id = await playId(postId, user.id, day);
    try {
      await entities.ArtPostPlay.create({
        id,
        post_id: postId,
        listener_id: user.id,
        play_day: day,
      });
    } catch (error) {
      const existing = await entities.ArtPostPlay.filter(
        {
          post_id: postId,
          listener_id: user.id,
          play_day: day,
        },
        '-created_date',
        1,
      );
      if (existing.length > 0) {
        return Response.json({ success: true, action: 'record_art_post_play', userId: user.id, postId, counted: false, reason: 'already_counted_today', views: Number(post.views || 0) });
      }
      throw error;
    }

    try {
      const countUpdate = await entities.ArtPost.updateMany(
        { id: postId },
        { $inc: { views: 1 } },
      );
      if (Number(countUpdate?.updated || 0) !== 1) {
        throw new Error('ArtPost play count did not update exactly one post');
      }
    } catch (countError) {
      try {
        await entities.ArtPostPlay.delete(id);
      } catch (rollbackError) {
        console.error('ArtPost play rollback failed:', rollbackError);
        throw new Error(
          'Play count update failed and play rollback was incomplete. Please retry.',
          { cause: countError },
        );
      }
      throw countError;
    }
    const updated = await entities.ArtPost.get(postId);
    return Response.json({ success: true, action: 'record_art_post_play', userId: user.id, postId, counted: true, views: Number(updated?.views || 0) });
    } finally {
      await releaseArtPostEngagementLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('recordArtPostPlay error:', error);
    return Response.json({ error: 'Could not record play' }, { status: 500 });
  }
}
