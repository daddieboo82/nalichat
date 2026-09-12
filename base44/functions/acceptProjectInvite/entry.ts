import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { acquireProjectMembershipLock, releaseProjectMembershipLock } from '../../shared/projectMembershipLock.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';

const ACCESS_SYNC_BATCH_SIZE = 200;
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

    const inviteRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'project_invite_accept',
      60,
    );
    if (!inviteRate.allowed) {
      return Response.json({ error: 'Invite acceptance rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { projectId, token } = await readJsonBodyLimited(req, 8 * 1024);
    if (
      typeof projectId !== 'string'
      || typeof token !== 'string'
      || !isBase44EntityId(projectId.trim())
      || !token.trim()
      || token.length > 256
    ) {
      return Response.json({ error: 'Invalid projectId or token' }, { status: 400 });
    }

    const tokenHash = await sha256Hex(token);
    const invites = await base44.asServiceRole.entities.ProjectInvite.filter(
      {
        project_id: projectId,
        token_hash: tokenHash,
      },
      '-created_date',
      1,
    );
    const invite = invites[0];
    if (!invite || new Date(invite.expires_at).getTime() < Date.now()) {
      return Response.json({ error: 'Invite is invalid or expired' }, { status: 403 });
    }
    const maxUses = Number(invite.max_uses || 25);

    const lockId = await acquireProjectMembershipLock(base44.asServiceRole.entities, projectId);
    if (!lockId) {
      return Response.json(
        { error: 'Project membership is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const project = await base44.asServiceRole.entities.Project.get(projectId);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const lockedInvite = await base44.asServiceRole.entities.ProjectInvite.get(invite.id).catch(() => null);
    if (
      !lockedInvite
      || lockedInvite.project_id !== projectId
      || lockedInvite.token_hash !== tokenHash
      || !['editor', 'viewer'].includes(lockedInvite.role)
      || new Date(lockedInvite.expires_at).getTime() < Date.now()
    ) {
      return Response.json({ error: 'Invite is invalid or expired' }, { status: 403 });
    }
    const lockedMaxUses = Number(lockedInvite.max_uses || 25);

    if (project.owner_id === user.id) {
      return Response.json({ success: true, role: 'owner', already_member: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if ((project.collaborator_ids || []).includes(user.id)) {
      return Response.json({
        success: true,
        role: project.collaborator_roles?.[user.id] || 'viewer',
        already_member: true,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const claim = await base44.asServiceRole.entities.ProjectInvite.updateMany(
      {
        id: lockedInvite.id,
        used_count: { $lt: lockedMaxUses },
      },
      { $inc: { used_count: 1 } },
    );
    if (Number(claim?.updated || 0) !== 1) {
      return Response.json({ error: 'Invite usage limit reached' }, { status: 410 });
    }

    let membershipGranted = false;
    try {
      if (project.owner_id !== user.id) {
      const collaboratorIds = Array.from(new Set([...(project.collaborator_ids || []), user.id]));
      const roles = { ...(project.collaborator_roles || {}), [user.id]: lockedInvite.role };
      const editorIds = new Set(project.editor_ids || []);
      if (lockedInvite.role === 'editor') editorIds.add(user.id);
      else editorIds.delete(user.id);

      await base44.asServiceRole.entities.Project.update(project.id, {
        collaborator_ids: collaboratorIds,
        collaborator_roles: roles,
        editor_ids: Array.from(editorIds),
      });
      // Project membership is the authoritative grant. Once this succeeds the
      // invite use must remain consumed even if a later child-sync repair fails.
      membershipGranted = true;

      // Keep child-record access in sync for already-existing collaborative data.
      for (const entityName of ['Track', 'TrackVersion', 'SharedFile', 'Folder', 'Milestone']) {
        const entity = base44.asServiceRole.entities[entityName];
        if (!entity) continue;
        for (let skip = 0; ; skip += ACCESS_SYNC_BATCH_SIZE) {
          const rows = await entity.filter(
            { project_id: project.id },
            '-created_date',
            ACCESS_SYNC_BATCH_SIZE,
            skip,
          );
          for (const row of rows) {
            const accessUserIds = Array.from(new Set([...(row.access_user_ids || []), user.id]));
            const patch: Record<string, any> = { access_user_ids: accessUserIds };
            if ('edit_user_ids' in row || entityName === 'Track' || entityName === 'TrackVersion' || entityName === 'Folder' || entityName === 'Milestone') {
              const editUserIds = new Set(row.edit_user_ids || []);
              if (lockedInvite.role === 'editor') editUserIds.add(user.id);
              else editUserIds.delete(user.id);
              patch.edit_user_ids = Array.from(editUserIds);
            }
            await entity.update(row.id, patch);
          }
          if (rows.length < ACCESS_SYNC_BATCH_SIZE) break;
        }
      }
    }

    return Response.json(
      { success: true, role: lockedInvite.role },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    } catch (grantError) {
      if (!membershipGranted) {
        try {
          await base44.asServiceRole.entities.ProjectInvite.updateMany(
            { id: invite.id, used_count: { $gt: 0 } },
            { $inc: { used_count: -1 } },
          );
        } catch (rollbackError) {
          console.error('Project invite usage rollback failed:', rollbackError);
          throw new Error(
            'Project invite acceptance failed and usage rollback was incomplete. Please retry.',
            { cause: grantError },
          );
        }
      }
      throw grantError;
    }
    } finally {
      await releaseProjectMembershipLock(base44.asServiceRole.entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not accept project invite' }, { status: 500 });
  }
});
