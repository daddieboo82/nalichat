import { describe, expect, it } from "vitest";
import { summarizeOnboardingProgress } from "../lib/onboardingProgress";

const event = (event_name, user_id, hour) => ({
  event_name, user_id, created_date: `2026-11-22T${hour}:00:00Z`,
});

describe("onboarding progress", () => {
  it("counts accounts once and respects completion and retry order", () => {
    const result = summarizeOnboardingProgress([
      event("onboarding_view", "completed", "10"),
      event("onboarding_submit", "retried", "11"),
      event("onboarding_save_failed", "retried", "10"),
      event("onboarding_complete", "completed", "09"),
      event("onboarding_view", "edited", "09"),
      event("onboarding_form_interaction", "edited", "09"),
      event("onboarding_validation_blocked", "", "10"),
      event("creator_challenge_open", "other", "10"),
    ]);
    expect(result.accounts).toBe(3);
    expect(result.unlinkedEvents).toBe(1);
    expect(result.counts).toEqual({
      onboarding_view: 0,
      onboarding_form_interaction: 1,
      onboarding_validation_blocked: 0,
      onboarding_submit: 1,
      onboarding_save_failed: 0,
      onboarding_profile_saved: 0,
      onboarding_session_refresh_failed: 0,
      onboarding_complete: 1,
    });
  });
  it("distinguishes confirmed profile saves awaiting session recovery from failed writes", () => {
    const result = summarizeOnboardingProgress([
      event("onboarding_submit", "saved-waiting", "09"),
      event("onboarding_session_refresh_failed", "saved-waiting", "10"),
      event("onboarding_submit", "write-failed", "09"),
      event("onboarding_save_failed", "write-failed", "10"),
      event("onboarding_session_refresh_failed", "later-completed", "10"),
      event("onboarding_complete", "later-completed", "11"),
    ]);
    expect(result.counts.onboarding_session_refresh_failed).toBe(1);
    expect(result.counts.onboarding_save_failed).toBe(1);
    expect(result.counts.onboarding_complete).toBe(1);
  });

  it("tracks a confirmed save separately when session recovery has no final outcome", () => {
    const result = summarizeOnboardingProgress([
      event("onboarding_submit", "save-confirmed", "09"),
      event("onboarding_profile_saved", "save-confirmed", "10"),
      event("onboarding_submit", "no-confirmation", "10"),
      event("onboarding_profile_saved", "later-recovered", "09"),
      event("onboarding_session_refresh_failed", "later-recovered", "10"),
    ]);
    expect(result.counts.onboarding_profile_saved).toBe(1);
    expect(result.counts.onboarding_submit).toBe(1);
    expect(result.counts.onboarding_session_refresh_failed).toBe(1);
  });

  it("does not downgrade a confirmed save when retry events arrive later", () => {
    const result = summarizeOnboardingProgress([
      event("onboarding_profile_saved", "saved", "09"),
      event("onboarding_submit", "saved", "10"),
      event("onboarding_save_failed", "saved", "11"),
      event("onboarding_session_refresh_failed", "recovering", "09"),
      event("onboarding_validation_blocked", "recovering", "10"),
      event("onboarding_profile_saved", "completed", "09"),
      event("onboarding_submit", "completed", "10"),
      event("onboarding_complete", "completed", "11"),
    ]);
    expect(result.counts.onboarding_profile_saved).toBe(1);
    expect(result.counts.onboarding_session_refresh_failed).toBe(1);
    expect(result.counts.onboarding_save_failed).toBe(0);
    expect(result.counts.onboarding_validation_blocked).toBe(0);
    expect(result.counts.onboarding_complete).toBe(1);
  });

  it("breaks down the latest validation blocks and excludes recovered accounts", () => {
    const blocked = (id, reason) => ({
      ...event("onboarding_validation_blocked", id, "09"),
      metadata: { reason },
    });
    const result = summarizeOnboardingProgress([
      blocked("missing", "missing_display_name"),
      blocked("invalid", "invalid_birthdate"),
      blocked("unknown", "unexpected_value"),
      blocked("recovered", "invalid_birthdate"),
      event("onboarding_complete", "recovered", "10"),
    ]);
    expect(result.validationCounts).toEqual({
      missing_display_name: 1,
      invalid_birthdate: 1,
      other: 1,
    });
  });
});
