import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveUserSubscription } from '../../shared/subscriptionAccess.ts';

const VALID_FILE_TYPES = new Set(['audio', 'video', 'image', 'session', 'document', 'other']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const size = Number(body?.file_size);
    if (!Number.isSafeInteger(size) || size <= 0) {
      return Response.json(
        { error: 'A positive integer file size is required.', code: 'INVALID_UPLOAD_SIZE' },
        { status: 400 },
      );
    }
    if (typeof body?.file_url !== 'string' || !body.file_url.startsWith('https://')) {
      return Response.json({ error: 'A valid uploaded file URL is required.' }, { status: 400 });
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
        size,
        limit,
      }, { status: 413 });
    }

    const record = await base44.asServiceRole.entities.SharedFile.create({
      name: typeof body.name === 'string' ? body.name.slice(0, 255) : 'Uploaded file',
      file_url: body.file_url,
      file_type: VALID_FILE_TYPES.has(body.file_type) ? body.file_type : 'other',
      file_size: size,
      uploader_id: user.id,
      uploader_name: user.display_name || user.full_name || user.email,
      description: typeof body.description === 'string' ? body.description.slice(0, 1000) : '',
      folder_id: typeof body.folder_id === 'string' ? body.folder_id : null,
      project_id: typeof body.project_id === 'string' ? body.project_id : null,
    });

    return Response.json({ file: record, limit });
  } catch (error) {
    console.error('finalizeSharedFileUpload error:', error);
    const message = error instanceof Error ? error.message : 'Unable to finalize upload';
    return Response.json({ error: message }, { status: 500 });
  }
});
