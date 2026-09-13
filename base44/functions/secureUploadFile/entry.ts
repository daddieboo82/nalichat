import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const MB = 1024 * 1024;
const MAX_BY_KIND: Record<string, number> = {
  image: 50 * MB,
  audio: 50 * MB,
  video: 100 * MB,
  file: 50 * MB,
};
const MAX_MULTIPART_BYTES = MAX_BY_KIND.video + 1 * MB;

function kindFor(file: File) {
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';

  // Some browsers provide an empty or generic MIME type for media selected
  // from device storage. Fall back to a small, explicit extension allowlist,
  // but never trust the request's claimed kind to raise the server-side limit.
  const extension = file.name.toLowerCase().split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(extension)) return 'image';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm'].includes(extension)) return 'audio';
  if (['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'].includes(extension)) return 'video';
  return 'file';
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'file_upload',
      60,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Upload rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return Response.json({ error: 'Multipart file upload required' }, { status: 400 });
    }

    const declaredLength = Number(req.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
      return Response.json({ error: 'Upload request is too large' }, { status: 413 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'A file is required' }, { status: 400 });
    }
    if (!file.name || file.name.length > 255 || file.size <= 0) {
      return Response.json({ error: 'The selected file is empty or invalid' }, { status: 400 });
    }

    const kind = kindFor(file);
    const maxBytes = MAX_BY_KIND[kind] || MAX_BY_KIND.file;
    if (file.size > maxBytes) {
      return Response.json({
        error: `${kind === 'video' ? 'Video' : 'File'} exceeds the allowed upload size`,
      }, { status: 413 });
    }

    const result = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const fileUrl = typeof result?.file_url === 'string' ? result.file_url : '';
    if (!fileUrl) {
      throw new Error('Upload provider returned no file URL');
    }

    return Response.json({
      success: true,
      action: 'secure_upload',
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || '',
      file_url: fileUrl,
    });
  } catch (error) {
    console.error('secureUploadFile error:', error);
    return Response.json({ error: 'File upload failed' }, { status: 500 });
  }
});
