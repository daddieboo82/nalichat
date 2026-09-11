import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import {
  acquireChallengeSubmissionLock,
  releaseChallengeSubmissionLock,
} from '../../shared/challengeSubmissionLock.ts';

async function canAccessParent(entities: any, user: any, parentType: string, parentId: string) {
  if (parentType === 'art_post') {
    const parent = await entities.ArtPost.get(parentId);
    return parent ? { allowed: true, parent } : { allowed: false, parent: null };
  }

  if (parentType === 'challenge_submission') {
    const parent = await entities.ChallengeSubmission.get(parentId);
    if (!parent) return { allowed: false, parent: null };
    const allowed = parent.status === 'approved'
      || user?.role === 'admin'
      || parent.producer_id === user?.id;
    return { allowed, parent };
  }

  if (parentType === 'track') {
    const parent = await entities.Track.get(parentId);
    if (!parent) return { allowed: false, parent: null };
    const allowed = user?.role === 'admin'
      || parent.uploaded_by === user?.id
      || (parent.access_user_ids || []).includes(user?.id);
    return { allowed, parent };
  }

  return { allowed: false, parent: null };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}

    const body = await req.json();
    const action = typeof body?.action === 'string' ? body.action : '';
    const parentType = typeof body?.parentType === 'string' ? body.parentType : '';
    const parentId = typeof body?.parentId === 'string' ? body.parentId.trim() : '';
    if (
      !['list', 'create'].includes(action)
      || !['art_post', 'challenge_submission', 'track'].includes(parentType)
      || !parentId
      || parentId.length > 200
    ) {
      return Response.json({ error: 'Valid action, parentType, and parentId are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    let submissionLockId: string | null = null;
    if (action === 'create' && parentType === 'challenge_submission') {
      submissionLockId = await acquireChallengeSubmissionLock(entities, parentId);
      if (!submissionLockId) {
        return Response.json(
          { error: 'Submission is being updated. Please retry.' },
          { status: 409 },
        );
      }
    }

    try {
    const access = await canAccessParent(entities, user, parentType, parentId);
    if (!access.parent) return Response.json({ error: 'Comment target not found' }, { status: 404 });
    if (!access.allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (action === 'list') {
      const rows = await entities.TrackComment.filter({ track_id: parentId }, 'created_date', 200);
      const comments = rows
        .filter((row: any) => !row.parent_type || row.parent_type === parentType)
        .map((row: any) => ({
          id: row.id,
          track_id: row.track_id,
          parent_type: row.parent_type || parentType,
          author_id: row.author_id,
          author_name: row.author_name,
          author_avatar: row.author_avatar,
          text: row.text,
          timestamp: row.timestamp,
          created_date: row.created_date,
        }));
      return Response.json({ comments });
    }

    if (action === 'create') {
      if (!user?.id) return Response.json({ error: 'Sign in to comment' }, { status: 401 });
      if (user.is_banned) {
        return Response.json({ error: 'banned' }, { status: 403 });
      }
      if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
        return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
      }

      const rate = await consumeHourlyLimit(entities, user.id, 'track_comment', 120);
      if (!rate.allowed) {
        return Response.json({ error: 'Comment rate limit exceeded. Please try again later.' }, { status: 429 });
      }

      if (typeof body?.text !== 'string') {
        return Response.json({ error: 'Comment text is required' }, { status: 400 });
      }
      const text = body.text.trim();
      if (!text) return Response.json({ error: 'Comment text is required' }, { status: 400 });
      if (text.length > 2000) {
        return Response.json({ error: 'Comment text must be 2000 characters or fewer' }, { status: 413 });
      }

      if (body?.timestamp != null && typeof body.timestamp !== 'number') {
        return Response.json({ error: 'timestamp must be a number' }, { status: 400 });
      }
      const timestamp = body?.timestamp == null ? null : body.timestamp;
      const comment = await entities.TrackComment.create({
        track_id: parentId,
        parent_type: parentType,
        author_id: user.id,
        author_name: user.display_name || user.full_name || 'User',
        author_avatar: user.avatar_url || null,
        text,
        ...(Number.isFinite(timestamp) && timestamp >= 0 ? { timestamp } : {}),
      });
      return Response.json({ comment });
    }

    return Response.json({ error: 'Unsupported comment action' }, { status: 400 });
    } finally {
      await releaseChallengeSubmissionLock(entities, submissionLockId);
    }
  } catch (error) {
    console.error('trackComments error:', error);
    return Response.json({ error: error?.message || 'Comment action failed' }, { status: 500 });
  }
});
