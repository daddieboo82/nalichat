import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const GOAL_MESSAGES = 20;
const GOAL_TASKS = 3;
const CREDITS_REWARD = 100;

function pad(n: number) { return String(n).padStart(2, '0'); }
function weekKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function weekendWindow(key: string) {
  const monday = new Date(`${key}T00:00:00`);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { starts_at: saturday.toISOString(), expires_at: sunday.toISOString() };
}
function goalMet(progress: any, member: 'a' | 'b') {
  return (progress[`member_${member}_messages`] || 0) >= GOAL_MESSAGES ||
    (progress[`member_${member}_tasks`] || 0) >= GOAL_TASKS;
}

async function activeSquad(entities: any, userId: string) {
  const [asA, asB] = await Promise.all([
    entities.Squad.filter({ member_a_id: userId, status: 'active' }),
    entities.Squad.filter({ member_b_id: userId, status: 'active' }),
  ]);
  return asA[0] || asB[0] || null;
}

async function getOrCreateProgress(entities: any, squad: any) {
  const key = weekKey();
  const id = `squad_progress_${squad.id}_${key}`;
  try {
    const existing = await entities.SquadProgress.get(id);
    if (existing) return existing;
  } catch (_) {}

  try {
    return await entities.SquadProgress.create({
      id,
      squad_id: squad.id,
      member_a_id: squad.member_a_id,
      member_b_id: squad.member_b_id,
      week_key: key,
    });
  } catch (_) {
    return await entities.SquadProgress.get(id);
  }
}

async function awardOnce(entities: any, userId: string, squad: any, progress: any) {
  const rewardId = `squad_reward_${progress.id}_${userId}`;
  try {
    await entities.SquadReward.create({
      id: rewardId,
      squad_id: squad.id,
      progress_id: progress.id,
      user_id: userId,
      credits: CREDITS_REWARD,
      week_key: progress.week_key,
    });
  } catch (_) {
    return false;
  }
  await entities.User.updateMany({ id: userId }, { $inc: { squad_credits: CREDITS_REWARD } });
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { type } = await req.json();
    if (!['message', 'task'].includes(type)) {
      return Response.json({ error: 'Invalid activity type' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const squad = await activeSquad(entities, user.id);
    if (!squad) return Response.json({ success: true, tracked: false });

    const progress = await getOrCreateProgress(entities, squad);
    const member = squad.member_a_id === user.id ? 'a' : 'b';
    const field = type === 'message'
      ? `member_${member}_messages`
      : `member_${member}_tasks`;

    await entities.SquadProgress.updateMany(
      { id: progress.id },
      { $inc: { [field]: 1 } },
    );

    let updated = await entities.SquadProgress.get(progress.id);

    if (!updated.bonus_unlocked && goalMet(updated, 'a') && goalMet(updated, 'b')) {
      const window = weekendWindow(updated.week_key);
      await entities.SquadProgress.update(updated.id, {
        bonus_unlocked: true,
        bonus_starts_at: window.starts_at,
        bonus_expires_at: window.expires_at,
      });
      updated = await entities.SquadProgress.get(updated.id);

      await Promise.all([
        awardOnce(entities, squad.member_a_id, squad, updated),
        awardOnce(entities, squad.member_b_id, squad, updated),
      ]);
    }

    return Response.json({ success: true, tracked: true, progress: updated });
  } catch (error) {
    console.error('recordSquadActivity error:', error);
    return Response.json({ error: error?.message || 'Could not record squad activity' }, { status: 500 });
  }
});
