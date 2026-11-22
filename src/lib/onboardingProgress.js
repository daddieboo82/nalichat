export const onboardingStages = [
  ["onboarding_view", "Opened setup"],
  ["onboarding_form_interaction", "Edited a field"],
  ["onboarding_validation_blocked", "Blocked by validation"],
  ["onboarding_submit", "Submitted without a recorded result"],
  ["onboarding_save_failed", "Save or session error"],
  ["onboarding_complete", "Completed setup"],
];

export const onboardingValidationReasons = [
  ["missing_display_name", "Missing display name"],
  ["invalid_birthdate", "Invalid birthdate"],
  ["other", "Other or unspecified"],
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
      latestByAccount.set(event.user_id, { name: event.event_name, timestamp, reason: event.metadata?.reason });
    }
  }

  const counts = Object.fromEntries(onboardingStages.map(([name]) => [name, 0]));
  const validationCounts = { missing_display_name: 0, invalid_birthdate: 0, other: 0 };
  for (const { name, reason } of latestByAccount.values()) {
    counts[name] += 1;
    if (name === "onboarding_validation_blocked") {
      const key = Object.hasOwn(validationCounts, reason) ? reason : "other";
      validationCounts[key] += 1;
    }
  }
  return { counts, validationCounts, accounts: latestByAccount.size, unlinkedEvents };
}
