import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const TRUSTED_MEDIA_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
];

function isTrustedStoredUrl(value: unknown): boolean {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return TRUSTED_MEDIA_HOSTS.some((host) => hostname === host || hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { fileId, token } = await req.json();
    const normalizedFileId = String(fileId || '').trim();
    const normalizedToken = String(token || '').trim();
    if (!normalizedFileId || normalizedFileId.length > 256 || !/^[0-9a-f]{64}$/.test(normalizedToken)) {
      return Response.json({ error: 'Invalid share link' }, { status: 400 });
    }

    const file = await base44.asServiceRole.entities.SharedFile.get(normalizedFileId);
    if (!file || !file.share_token_hash) {
      return Response.json({ error: 'Share link not found' }, { status: 404 });
    }
    if (file.share_token_expires_at && new Date(file.share_token_expires_at).getTime() <= Date.now()) {
      return Response.json({ error: 'Share link expired' }, { status: 410 });
    }

    const candidate = await sha256Hex(normalizedToken);
    if (!constantTimeEqual(candidate, String(file.share_token_hash))) {
      return Response.json({ error: 'Invalid share token' }, { status: 403 });
    }
    if (!isTrustedStoredUrl(file.file_url)) {
      return Response.json({ error: 'Shared file media host is not allowed' }, { status: 400 });
    }

    return Response.json({
      file: {
        id: file.id,
        name: file.name,
        file_url: file.file_url,
        file_type: file.file_type,
        file_size: file.file_size,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not load shared file' }, { status: 500 });
  }
});
