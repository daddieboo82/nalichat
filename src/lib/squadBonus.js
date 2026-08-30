import { base44 } from "@/api/base44Client";
import { startOfWeek, addDays, endOfDay } from "date-fns";

export const GOAL_MESSAGES = 20;
export const GOAL_TASKS = 3;
export const CREDITS_REWARD = 100;
export const BONUS_MULTIPLIER = 1.5;

function pad(n) { return String(n).padStart(2, "0"); }
function toDateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function getWeekKey(date = new Date()) {
  return toDateKey(startOfWeek(date, { weekStartsOn: 1 }));
}

export function getWeekendWindow(weekKey) {
  const monday = new Date(`${weekKey}T00:00:00`);
  const saturday = addDays(monday, 5);
  const sunday = endOfDay(addDays(monday, 6));
  return { starts_at: saturday.toISOString(), expires_at: sunday.toISOString() };
}

export function memberGoalMet(progress, member) {
  const messages = progress[`member_${member}_messages`] || 0;
  const tasks = progress[`member_${member}_tasks`] || 0;
  return messages >= GOAL_MESSAGES || tasks >= GOAL_TASKS;
}

export function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function getActiveSquad(userId) {
  const [asA, asB] = await Promise.all([
    base44.entities.Squad.filter({ member_a_id: userId, status: "active" }),
    base44.entities.Squad.filter({ member_b_id: userId, status: "active" }),
  ]);
  return asA[0] || asB[0] || null;
}

export async function getOrCreateWeekProgress(squad) {
  const week_key = getWeekKey();
  const existing = await base44.entities.SquadProgress.filter({ squad_id: squad.id, week_key });
  if (existing[0]) return existing[0];
  return base44.entities.SquadProgress.create({
    squad_id: squad.id,
    member_a_id: squad.member_a_id,
    member_b_id: squad.member_b_id,
    week_key,
  });
}

// Call after a chat message is sent or a task (milestone/track) is completed.
export async function recordSquadActivity(userId, type) {
  try {
    const squad = await getActiveSquad(userId);
    if (!squad) return;
    const progress = await getOrCreateWeekProgress(squad);
    const member = squad.member_a_id === userId ? "a" : "b";
    const field = type === "message" ? `member_${member}_messages` : `member_${member}_tasks`;
    const updates = { [field]: (progress[field] || 0) + 1 };
    const merged = { ...progress, ...updates };

    if (!progress.bonus_unlocked && memberGoalMet(merged, "a") && memberGoalMet(merged, "b")) {
      const { starts_at, expires_at } = getWeekendWindow(progress.week_key);
      updates.bonus_unlocked = true;
      updates.bonus_starts_at = starts_at;
      updates.bonus_expires_at = expires_at;
    }

    await base44.entities.SquadProgress.update(progress.id, updates);
  } catch (err) {
    console.error("Failed to record squad activity:", err);
  }
}

// Returns whether the 1.5x bonus is active right now for this user, and lazily
// grants the one-time credits reward the first time this user sees it unlocked.
export async function getSquadBonusStatus(user) {
  if (!user) return { active: false, multiplier: 1, squad: null, progress: null };
  const squad = await getActiveSquad(user.id);
  if (!squad) return { active: false, multiplier: 1, squad: null, progress: null };

  const progress = await getOrCreateWeekProgress(squad);
  const now = new Date();
  const active = !!(
    progress.bonus_unlocked &&
    progress.bonus_starts_at &&
    progress.bonus_expires_at &&
    now >= new Date(progress.bonus_starts_at) &&
    now <= new Date(progress.bonus_expires_at)
  );

  if (progress.bonus_unlocked) {
    const member = squad.member_a_id === user.id ? "a" : "b";
    const field = `credits_awarded_${member}`;
    if (!progress[field]) {
      try {
        await base44.entities.SquadProgress.update(progress.id, { [field]: true });
        await base44.auth.updateMe({ squad_credits: (user.squad_credits || 0) + CREDITS_REWARD });
      } catch (err) {
        console.error("Failed to award squad credits:", err);
      }
    }
  }

  return { active, multiplier: active ? BONUS_MULTIPLIER : 1, squad, progress };
}