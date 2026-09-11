import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { fileId, token } = await req.json();
    if (!fileId || !token) {
      return Response.json({ error: 'fileId and token are required' }, { status: 400 });
    }

    const file = await base44.asServiceRole.entities.SharedFile.get(fileId);
    if (!file || !file.share_token_hash) {
      return Response.json({ error: 'Share link not found' }, { status: 404 });
    }
    const candidate = await sha256Hex(String(token));
    if (candidate !== file.share_token_hash) {
      return Response.json({ error: 'Invalid share token' }, { status: 403 });
    }

    return Response.json({
      file: {
        id: file.id,
        name: file.name,
        file_url: file.file_url,
        file_type: file.file_type,
        file_size: file.file_size,
      },
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not load shared file' }, { status: 500 });
  }
});
