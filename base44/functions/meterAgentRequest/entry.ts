import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
  commitAiUsage,
  readAiQuota,
  reserveAiUsage,
  utcUsageWindow,
} from '../../shared/aiQuota.ts';
import { resolveUserSubscription } from '../../shared/subscriptionAccess.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, request_key, reservation_day } = await req.json();
    const now = new Date();
    const { utcDay, resetAt } = utcUsageWindow(now);
    const access = await resolveUserSubscription(
      base44.asServiceRole.entities.Subscription,
      user.id,
      now.toISOString(),
    );
    const limit = access.limits.ai.requestsPerUtcDay;

    if (action === 'reserve') {
      const { quota } = await reserveAiUsage({
        entity: base44.asServiceRole.entities.AIUsage,
        userId: user.id,
        operation: 'assistant',
        requestKey: request_key,
        limit,
        now,
      });
      return Response.json({ reserved: true, reservation_day: utcDay, quota });
    }

    const previousDay = new Date(`${utcDay}T00:00:00.000Z`);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    const validReservationDays = new Set([utcDay, previousDay.toISOString().slice(0, 10)]);
    if (!validReservationDays.has(reservation_day)) {
      return Response.json({ error: 'Invalid reservation day.' }, { status: 400 });
    }
    const matches = await base44.asServiceRole.entities.AIUsage.filter({
      user_id: user.id,
      utc_day: reservation_day,
      request_key,
    });
    const dispatched = matches.find((record) => record.status === 'dispatched');
    if (action === 'dispatch' && dispatched) {
      const reservationReset = new Date(`${reservation_day}T00:00:00.000Z`);
      reservationReset.setUTCDate(reservationReset.getUTCDate() + 1);
      const quota = await readAiQuota(
        base44.asServiceRole.entities.AIUsage,
        user.id,
        reservation_day,
        limit,
        reservationReset.toISOString(),
      );
      return Response.json({ dispatched: true, quota });
    }

    const reservation = matches.find((record) => record.status === 'reserved');
    if (!reservation) {
      return Response.json(
        { error: 'AI usage reservation not found.', code: 'AI_RESERVATION_NOT_FOUND' },
        { status: 409 },
      );
    }

    if (action === 'release') {
      await base44.asServiceRole.entities.AIUsage.delete(reservation.id);
      return Response.json({ released: true });
    }
    if (action !== 'dispatch') {
      return Response.json({ error: 'Invalid metering action.' }, { status: 400 });
    }

    const quota = await commitAiUsage({
      entity: base44.asServiceRole.entities.AIUsage,
      reservation,
      limit,
      resetAt: reservation_day === utcDay
        ? resetAt
        : `${utcDay}T00:00:00.000Z`,
      now,
    });
    return Response.json({ dispatched: true, quota });
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    console.error('meterAgentRequest error:', error);
    const message = error instanceof Error ? error.message : 'Unable to meter assistant request';
    return Response.json({ error: message }, { status: 500 });
  }
});
