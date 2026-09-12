import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { acquireProjectMembershipLock, releaseProjectMembershipLock } from '../../shared/projectMembershipLock.ts';

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

    const revokeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'project_invite_revoke',
      60,
    );
    if (!revokeRate.allowed) {
      return Response.json({ error: 'Invite revocation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 8 * 1024);
    const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
    const role = body?.role == null ? null : String(body.role);
    if (!isBase44EntityId(projectId)) {
      return Response.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (role && !['editor', 'viewer'].includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const projectPreview = await entities.Project.get(projectId).catch(() => null);
    if (!projectPreview) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (projectPreview.owner_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the project owner can revoke invite links' }, { status: 403 });
    }

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
    if (project.owner_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the project owner can revoke invite links' }, { status: 403 });
    }

    const filters: Record<string, unknown> = { project_id: project.id };
    if (role) filters.role = role;
    let revoked = 0;
    while (true) {
      const invites = await entities.ProjectInvite.filter(
        filters,
        '-created_date',
        200,
      );
      if (invites.length === 0) break;

      for (const invite of invites) {
        await entities.ProjectInvite.delete(invite.id);
        revoked += 1;
      }

      if (invites.length < 200) break;
    }

    return Response.json({
      success: true,
      revoked,
      role,
    }, { headers: { 'Cache-Control': 'no-store' } });
    } finally {
      await releaseProjectMembershipLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('revokeProjectInvites error:', error);
    return Response.json({ error: 'Could not revoke invite links' }, { status: 500 });
  }
});
