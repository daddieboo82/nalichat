import { describe, expect, it } from "vitest";
import { assignPaywallVariant, getPaywallCopy } from "@/lib/paywallConfig";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("paywall variant assignment", () => {
  it("persists a deterministic assignment for an authenticated user", () => {
    const storage = memoryStorage();
    const first = assignPaywallVariant("user-123", storage);
    const second = assignPaywallVariant("user-123", storage);

    expect(["A", "B"]).toContain(first);
    expect(second).toBe(first);
    expect(getPaywallCopy(first).id).toBe(first);
  });

  it("persists an anonymous identifier and assignment until login", () => {
    const storage = memoryStorage();
    const first = assignPaywallVariant(null, storage);
    const second = assignPaywallVariant(null, storage);

    expect(second).toBe(first);
  });
});

