import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

function pad(n: number) { return String(n).padStart(2, '0'); }
function weekKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

    const entities = base44.asServiceRole.entities;
    const readRate = await consumeHourlyLimit(entities, user.id, 'squad_bonus_status', 300);
    if (!readRate.allowed) {
      return Response.json({ error: 'Squad status rate limit exceeded. Please try again later.' }, { status: 429 });
    }
    const [asA, asB] = await Promise.all([
      entities.Squad.filter({ member_a_id: user.id, status: 'active' }, '-created_date', 1),
      entities.Squad.filter({ member_b_id: user.id, status: 'active' }, '-created_date', 1),
    ]);
    const squad = asA[0] || asB[0] || null;
    if (!squad) {
      return Response.json({ active: false, multiplier: 1, squad: null, progress: null });
    }

    const key = weekKey();
    const progressRows = await entities.SquadProgress.filter(
      { squad_id: squad.id, week_key: key },
      '-created_date',
      1,
    );
    const progress = progressRows[0] || null;
    const now = Date.now();
    const active = Boolean(
      progress?.bonus_unlocked &&
      progress?.bonus_starts_at &&
      progress?.bonus_expires_at &&
      now >= new Date(progress.bonus_starts_at).getTime() &&
      now <= new Date(progress.bonus_expires_at).getTime()
    );

    return Response.json({
      active,
      multiplier: active ? 1.5 : 1,
      squad,
      progress,
    });
  } catch (error) {
    return Response.json({ error: 'Could not load squad bonus status' }, { status: 500 });
  }
});
