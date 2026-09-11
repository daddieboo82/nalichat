import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

async function canAccessParent(entities: any, user: any, parentType: string, parentId: string) {
  if (parentType === 'art_post') {
    const parent = await entities.ArtPost.get(parentId);
    return parent ? { allowed: true, parent } : { allowed: false, parent: null };
  }

  if (parentType === 'challenge_submission') {
    const parent = await entities.ChallengeSubmission.get(parentId);
    return parent ? { allowed: true, parent } : { allowed: false, parent: null };
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
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}

    const body = await req.json();
    const action = body?.action;
    const parentType = String(body?.parentType || '');
    const parentId = String(body?.parentId || '');
    if (!['art_post', 'challenge_submission', 'track'].includes(parentType) || !parentId) {
      return Response.json({ error: 'Valid parentType and parentId are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
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

      const rate = await consumeHourlyLimit(entities, user.id, 'track_comment', 120);
      if (!rate.allowed) {
        return Response.json({ error: 'Comment rate limit exceeded. Please try again later.' }, { status: 429 });
      }

      const text = String(body?.text || '').trim().slice(0, 2000);
      if (!text) return Response.json({ error: 'Comment text is required' }, { status: 400 });

      const timestamp = body?.timestamp == null ? null : Number(body.timestamp);
      const comment = await entities.TrackComment.create({
        track_id: parentId,
        parent_type: parentType,
        author_id: user.id,
        author_name: user.display_name || user.full_name || user.email || 'User',
        author_avatar: user.avatar_url || null,
        text,
        ...(Number.isFinite(timestamp) && timestamp >= 0 ? { timestamp } : {}),
      });
      return Response.json({ comment });
    }

    return Response.json({ error: 'Unsupported comment action' }, { status: 400 });
  } catch (error) {
    console.error('trackComments error:', error);
    return Response.json({ error: error?.message || 'Comment action failed' }, { status: 500 });
  }
});
