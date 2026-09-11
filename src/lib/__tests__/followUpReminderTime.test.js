// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  defaultReminderTime,
  localDateTimeToUtc,
  toLocalDateTimeInput,
} from "@/lib/followUpReminders";

describe("follow-up reminder timezone helpers", () => {
  it("round-trips a UTC instant through a browser-local date/time value", () => {
    const instant = new Date("2026-09-10T19:45:00.000Z");
    const localValue = toLocalDateTimeInput(instant);
    expect(localDateTimeToUtc(localValue)).toBe(instant.toISOString());
  });

  it("defaults to thirty minutes after the local clock", () => {
    const now = new Date("2026-09-10T19:13:00.000Z");
    expect(localDateTimeToUtc(defaultReminderTime(now)))
      .toBe("2026-09-10T19:43:00.000Z");
  });

  it("rejects invalid local input", () => {
    expect(localDateTimeToUtc("not-a-date")).toBeNull();
  });
});
