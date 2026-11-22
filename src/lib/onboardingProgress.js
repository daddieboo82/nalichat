export const onboardingStages = [
  ["onboarding_view", "Opened setup"],
  ["onboarding_form_interaction", "Edited a field"],
  ["onboarding_validation_blocked", "Blocked by validation"],
  ["onboarding_submit", "Submitted without a recorded result"],
  ["onboarding_save_failed", "Save or session error"],
  ["onboarding_complete", "Completed setup"],
];

const stageOrder = new Map(onboardingStages.map(([name], index) => [name, index]));

export function summarizeOnboardingProgress(events) {
  const latestByAccount = new Map();
  let unlinkedEvents = 0;
  for (const event of events) {
    if (!stageOrder.has(event.event_name)) continue;
    if (!event.user_id) {
      unlinkedEvents += 1;
      continue;
    }
    const previous = latestByAccount.get(event.user_id);
    const timestamp = Date.parse(event.created_date || event.created_at) || 0;
    if (previous?.name === "onboarding_complete") continue;
    const completed = event.event_name === "onboarding_complete";
    const newer = !previous || timestamp > previous.timestamp;
    const sameTimeLaterStage = previous && timestamp === previous.timestamp &&
      stageOrder.get(event.event_name) > stageOrder.get(previous.name);
    if (completed || newer || sameTimeLaterStage) {
      latestByAccount.set(event.user_id, { name: event.event_name, timestamp });
    }
  }

  const counts = Object.fromEntries(onboardingStages.map(([name]) => [name, 0]));
  for (const { name } of latestByAccount.values()) counts[name] += 1;
  return { counts, accounts: latestByAccount.size, unlinkedEvents };
}
