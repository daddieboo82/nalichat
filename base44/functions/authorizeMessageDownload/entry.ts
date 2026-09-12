import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
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

    const downloadRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'message_download_authorization',
      600,
    );
    if (!downloadRate.allowed) {
      return Response.json({ error: 'Download authorization rate limit exceeded.' }, { status: 429 });
    }

    const { messageId } = await req.json();
    if (!messageId) return Response.json({ error: 'messageId is required' }, { status: 400 });

    const message = await base44.asServiceRole.entities.Message.get(messageId);
    if (!message) return Response.json({ error: 'Message not found' }, { status: 404 });
    if (!Array.isArray(message.participant_ids) || !message.participant_ids.includes(user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isSender = message.sender_id === user.id;
    if (!isSender) {
      const { allowed } = await requireEntitlement(
        base44.asServiceRole.entities,
        user.id,
        'chat.export',
      );
      if (!allowed) {
        return Response.json({ error: 'Download entitlement required' }, { status: 403 });
      }
    }

    if (!message.file_url) return Response.json({ error: 'Message has no downloadable media' }, { status: 400 });
    if (!isTrustedStoredMediaUrl(message.file_url)) {
      return Response.json({ error: 'Stored message media host is not allowed' }, { status: 400 });
    }
    return Response.json({
      success: true,
      file_url: message.file_url,
      file_name: message.file_name || 'file',
    });
  } catch (error) {
    console.error('authorizeMessageDownload error:', error);
    return Response.json({ error: error?.message || 'Could not authorize download' }, { status: 500 });
  }
});
