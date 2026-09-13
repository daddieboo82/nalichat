import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeLockedChatPinReset,
  configureLockedChatPin,
  verifyLockedChatPin,
} from "@/lib/lockedChatClient";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@/api/base44Client", () => ({
  base44: { functions: { invoke } },
}));

describe("locked chat client protocol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockImplementation(async (_name, payload) => ({
      data: {
        success: true,
        action: payload.action,
        userId: "user-123",
        unlocked: true,
        security: { configured: true },
        reset: payload.action === "complete_reset",
      },
    }));
  });

  it("never sends the plaintext PIN during setup", async () => {
    await configureLockedChatPin("123456", "user-123");
    const [, payload] = invoke.mock.calls[0];

    expect(payload.action).toBe("set_pin");
    expect(payload.pin).toBeUndefined();
    expect(payload.verifier).not.toBe("123456");
    expect(atob(payload.salt)).toHaveLength(16);
    expect(atob(payload.verifier)).toHaveLength(32);
  }, 10_000);

  it("derives a candidate verifier locally during unlock", async () => {
    await verifyLockedChatPin("123456", {
      salt: btoa("1234567890123456"),
      iterations: 600_000,
    }, "user-123");
    const [, payload] = invoke.mock.calls[0];

    expect(payload).toEqual({
      action: "verify_pin",
      verifier: expect.any(String),
    });
    expect(payload.verifier).not.toBe("123456");
  }, 10_000);

  it("sends only the one-time code and a new verifier during reset", async () => {
    await completeLockedChatPinReset("654321", "123456", "user-123");
    const [, payload] = invoke.mock.calls[0];

    expect(payload.action).toBe("complete_reset");
    expect(payload.code).toBe("654321");
    expect(payload.pin).toBeUndefined();
    expect(payload.verifier).not.toBe("123456");
  }, 10_000);
});
