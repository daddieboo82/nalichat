import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entities = base44.asServiceRole.entities;
    const [asA, asB] = await Promise.all([
      entities.Squad.filter({ member_a_id: user.id, status: 'active' }),
      entities.Squad.filter({ member_b_id: user.id, status: 'active' }),
    ]);
    const squad = asA[0] || asB[0] || null;
    if (!squad) {
      return Response.json({ active: false, multiplier: 1, squad: null, progress: null });
    }

    const key = weekKey();
    const progressRows = await entities.SquadProgress.filter({ squad_id: squad.id, week_key: key });
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
    return Response.json({ error: error?.message || 'Could not load squad bonus status' }, { status: 500 });
  }
});
