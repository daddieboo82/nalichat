import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Leaving is a cleanup/self-removal action. Moderated users must still be
    // able to exit a squad so membership claims cannot strand the account.

    const { squadId } = await readJsonBodyLimited(req, 8 * 1024);
    const normalizedSquadId = String(squadId || '').trim();
    if (!isBase44EntityId(normalizedSquadId)) {
      return Response.json({ error: 'Valid squadId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const squadRate = await consumeHourlyLimit(entities, user.id, 'squad_leave', 60);
    if (!squadRate.allowed) {
      return Response.json({ error: 'Squad action rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const squad = await entities.Squad.get(normalizedSquadId);
    if (!squad || (squad.member_a_id !== user.id && squad.member_b_id !== user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await entities.Squad.update(squad.id, { status: 'ended' });

    const memberIds = [squad.member_a_id, squad.member_b_id].filter(Boolean);
    const clearResults = await Promise.allSettled(
      memberIds.map((memberId) => entities.User.updateMany(
        { id: memberId, squad_membership_id: squad.id },
        { $set: { squad_membership_id: null } },
      )),
    );
    const failedClears = clearResults.filter((result) => result.status === 'rejected').length;
    if (failedClears > 0) {
      return Response.json(
        {
          error: 'Squad ended, but member cleanup was incomplete. Please retry.',
          retryable: true,
          failed_member_updates: failedClears,
        },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      userId: user.id,
      squadId: normalizedSquadId,
      status: 'ended',
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not leave squad' }, { status: 500 });
  }
});
