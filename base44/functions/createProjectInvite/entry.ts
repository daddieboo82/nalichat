import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { acquireProjectMembershipLock, releaseProjectMembershipLock } from '../../shared/projectMembershipLock.ts';

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

    const { projectId, role } = await readJsonBodyLimited(req, 64 * 1024);
    if (
      typeof projectId !== 'string'
      || !projectId.trim()
      || projectId.length > 200
      || !['editor', 'viewer'].includes(role)
    ) {
      return Response.json({ error: 'projectId and valid role are required' }, { status: 400 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'project_invite_create',
      30,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Invite creation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const entities = base44.asServiceRole.entities;
    const lockId = await acquireProjectMembershipLock(entities, projectId);
    if (!lockId) {
      return Response.json(
        { error: 'Project membership is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const project = await entities.Project.get(projectId);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (project.owner_id !== user.id) {
      return Response.json({ error: 'Only the project owner can create invite links' }, { status: 403 });
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await entities.ProjectInvite.create({
      project_id: project.id,
      token_hash: await sha256Hex(token),
      role,
      created_by_id: user.id,
      expires_at: expiresAt,
      used_count: 0,
      max_uses: 25,
    });

    return Response.json({
      success: true,
      token,
      projectId: project.id,
      role,
      expiresAt,
      maxUses: 25,
    }, { headers: { 'Cache-Control': 'no-store' } });
    } finally {
      await releaseProjectMembershipLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: error?.message || 'Could not create project invite' }, { status: 500 });
  }
});
