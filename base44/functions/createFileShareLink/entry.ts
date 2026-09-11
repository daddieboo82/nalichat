import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fileId } = await req.json();
    if (!fileId) return Response.json({ error: 'fileId is required' }, { status: 400 });

    const file = await base44.asServiceRole.entities.SharedFile.get(fileId);
    if (!file) return Response.json({ error: 'File not found' }, { status: 404 });
    const canShare = user.role === 'admin'
      || file.uploader_id === user.id
      || (file.edit_user_ids || []).includes(user.id);
    if (!canShare) {
      return Response.json({ error: 'You do not have permission to share this file' }, { status: 403 });
    }

    const token = randomToken();
    await base44.asServiceRole.entities.SharedFile.update(fileId, {
      share_token_hash: await sha256Hex(token),
    });

    return Response.json({ success: true, fileId, token });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not create share link' }, { status: 500 });
  }
});
