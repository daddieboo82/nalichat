import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { isTrustedStoredMediaUrl } from '../../shared/mediaSecurity.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const downloadRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'art_post_download_authorization',
      600,
    );
    if (!downloadRate.allowed) {
      return Response.json({ error: 'Download authorization rate limit exceeded.' }, { status: 429 });
    }

    const { postId } = await readJsonBodyLimited(req, 8 * 1024);
    if (!isBase44EntityId(postId)) return Response.json({ error: 'Valid postId is required' }, { status: 400 });

    const post = await base44.asServiceRole.entities.ArtPost.get(postId);
    if (!post) return Response.json({ error: 'Track not found' }, { status: 404 });

    const isOwner = post.creator_id === user.id;
    if (!isOwner) {
      const { allowed } = await requireEntitlement(
        base44.asServiceRole.entities,
        user.id,
        'chat.export',
      );
      if (!allowed) {
        return Response.json({ error: 'Download entitlement required' }, { status: 403 });
      }
    }

    if (!post.file_url) return Response.json({ error: 'Track has no downloadable media' }, { status: 400 });
    if (!isTrustedStoredMediaUrl(post.file_url)) {
      return Response.json({ error: 'Stored track media host is not allowed' }, { status: 400 });
    }
    return Response.json({ success: true, file_url: post.file_url, title: post.title || 'download' });
  } catch (error) {
    console.error('authorizeArtPostDownload error:', error);
    return Response.json({ error: error?.message || 'Could not authorize download' }, { status: 500 });
  }
});
