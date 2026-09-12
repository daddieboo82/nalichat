import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { acquireSharedFileMutationLock, releaseSharedFileMutationLock } from '../../shared/sharedFileMutationLock.ts';

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

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'file_share_link',
      120,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { fileId } = await readJsonBodyLimited(req, 8 * 1024);
    if (!isBase44EntityId(fileId)) {
      return Response.json({ error: 'fileId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const filePreview = await entities.SharedFile.get(fileId).catch(() => null);
    if (!filePreview) return Response.json({ error: 'File not found' }, { status: 404 });
    if (filePreview.project_id && !isBase44EntityId(filePreview.project_id)) {
      return Response.json({ error: 'File has an invalid project reference' }, { status: 409 });
    }

    let previewCanShare = user.role === 'admin';
    if (!previewCanShare && filePreview.project_id) {
      const projectPreview = await entities.Project.get(filePreview.project_id).catch(() => null);
      if (!projectPreview) return Response.json({ error: 'Project not found' }, { status: 404 });
      previewCanShare = projectPreview.owner_id === user.id || (projectPreview.editor_ids || []).includes(user.id);
    } else if (!previewCanShare) {
      previewCanShare = filePreview.uploader_id === user.id
        || (filePreview.edit_user_ids || []).includes(user.id);
    }
    if (!previewCanShare) {
      return Response.json({ error: 'You do not have permission to share this file' }, { status: 403 });
    }

    const lockId = await acquireSharedFileMutationLock(entities, fileId);
    if (!lockId) {
      return Response.json(
        { error: 'File is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const file = await entities.SharedFile.get(fileId);
    if (!file) return Response.json({ error: 'File not found' }, { status: 404 });

    let canShare = user.role === 'admin';
    if (!canShare && file.project_id) {
      const project = await entities.Project.get(file.project_id).catch(() => null);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      canShare = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
    } else if (!canShare) {
      canShare = file.uploader_id === user.id || (file.edit_user_ids || []).includes(user.id);
    }
    if (!canShare) {
      return Response.json({ error: 'You do not have permission to share this file' }, { status: 403 });
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await entities.SharedFile.update(fileId, {
      share_token_hash: await sha256Hex(token),
      share_token_expires_at: expiresAt,
    });

    return Response.json(
      { success: true, fileId, token, expires_at: expiresAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    } finally {
      await releaseSharedFileMutationLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('createFileShareLink error:', error);
    return Response.json({ error: 'Could not create share link' }, { status: 500 });
  }
});
