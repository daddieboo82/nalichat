import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const collaborationRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'collaboration_session_action',
      600,
    );
    if (!collaborationRate.allowed) {
      return Response.json({ error: 'Collaboration action rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { action, session_id, collaborators, changes } = await readJsonBodyLimited(req, 64 * 1024);

    if (typeof session_id !== 'string' || !isBase44EntityId(session_id.trim())) {
      return Response.json({ error: 'Valid session_id is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const project = await entities.Project.get(session_id).catch(() => null);
    if (!project) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const collaboratorIds = Array.isArray(project.collaborator_ids)
      ? project.collaborator_ids
      : [];
    const isOwner = project.owner_id === user.id;
    const isCollaborator = collaboratorIds.includes(user.id);
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isCollaborator && !isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const collaboratorRole = project.collaborator_roles?.[user.id];
    const canEdit = isOwner || isAdmin || collaboratorRole === 'editor';

    // Handle different collaboration actions
    if (action === 'join_session') {
      // User joins a studio session
      // In a real implementation, this would use WebSockets or Server-Sent Events
      return Response.json({
        session_id,
        user_id: user.id,
        user_name: user.full_name,
        avatar_url: user.avatar_url,
        timestamp: new Date().toISOString(),
        message: 'Joined session',
      });
    }

    if (action === 'broadcast_changes') {
      if (!canEdit) {
        return Response.json({ error: 'Editor access required' }, { status: 403 });
      }

      // Broadcast changes to all collaborators
      // Changes include: volume adjustments, panning, effects, etc.
      return Response.json({
        session_id,
        broadcaster: {
          id: user.id,
          name: user.full_name,
          avatar_url: user.avatar_url,
        },
        changes,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'sync_state') {
      // Return current session state for late joiners
      return Response.json({
        session_id,
        timestamp: new Date().toISOString(),
        status: 'synced',
      });
    }

    if (action === 'leave_session') {
      // User leaves the session
      return Response.json({
        session_id,
        user_id: user.id,
        timestamp: new Date().toISOString(),
        message: 'Left session',
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Collaboration update failed' }, { status: 500 });
  }
});