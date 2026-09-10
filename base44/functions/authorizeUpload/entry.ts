import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveUserSubscription } from '../../shared/subscriptionAccess.ts';

const VALID_KINDS = new Set(['image', 'audio', 'video', 'file']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const size = Number(body?.size);
    const kind = VALID_KINDS.has(body?.kind) ? body.kind : 'file';
    if (!Number.isSafeInteger(size) || size <= 0) {
      return Response.json(
        { error: 'A positive integer file size is required.', code: 'INVALID_UPLOAD_SIZE' },
        { status: 400 },
      );
    }

    const access = await resolveUserSubscription(
      base44.asServiceRole.entities.Subscription,
      user.id,
    );
    const limit = access.limits.upload.maxBytes;
    if (size > limit) {
      return Response.json({
        error: 'Upload exceeds the maximum size for this subscription.',
        code: 'UPLOAD_SIZE_LIMIT_EXCEEDED',
        kind,
        size,
        limit,
      }, { status: 413 });
    }

    return Response.json({
      authorized: true,
      kind,
      size,
      limit,
      plan: access.plan,
    });
  } catch (error) {
    console.error('authorizeUpload error:', error);
    const message = error instanceof Error ? error.message : 'Unable to authorize upload';
    return Response.json({ error: message, code: 'UPLOAD_AUTHORIZATION_FAILED' }, { status: 500 });
  }
});
