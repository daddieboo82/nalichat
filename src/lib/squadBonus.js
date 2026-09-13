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
  const messages = progress?.[`member_${member}_messages`] || 0;
  const tasks = progress?.[`member_${member}_tasks`] || 0;
  return messages >= GOAL_MESSAGES || tasks >= GOAL_TASKS;
}

export async function recordSquadActivity(sourceType, sourceId) {
  try {
    await base44.functions.invoke("recordSquadActivity", { sourceType, sourceId });
  } catch (err) {
    console.error("Failed to record squad activity:", err);
  }
}

export async function getSquadBonusStatus(expectedUserId) {
  try {
    const res = await base44.functions.invoke("getSquadBonusStatus", {});
    const data = res?.data;
    if (
      data?.success !== true ||
      typeof data?.userId !== "string" ||
      !data.userId.trim() ||
      (expectedUserId && data.userId !== expectedUserId) ||
      typeof data?.active !== "boolean" ||
      ![1, BONUS_MULTIPLIER].includes(Number(data?.multiplier))
    ) {
      throw new Error(data?.error || "Squad bonus status was not confirmed.");
    }
    return data;
  } catch (err) {
    console.error("Failed to load squad bonus status:", err);
    return { active: false, multiplier: 1, squad: null, progress: null };
  }
}
