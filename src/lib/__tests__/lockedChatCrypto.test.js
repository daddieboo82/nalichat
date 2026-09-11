import { describe, expect, it } from "vitest";
import {
  createLockedChatSalt,
  deriveLockedChatPinVerifier,
  LOCKED_CHAT_PBKDF2_ITERATIONS,
  validateLockedChatPin,
} from "@/lib/lockedChatCrypto";

describe("locked chat PIN cryptography", () => {
  it("accepts only a 6-12 digit PIN", () => {
    expect(validateLockedChatPin("123456")).toBe(true);
    expect(validateLockedChatPin("123456789012")).toBe(true);
    expect(validateLockedChatPin("12345")).toBe(false);
    expect(validateLockedChatPin("1234567890123")).toBe(false);
    expect(validateLockedChatPin("12345a")).toBe(false);
  });
  it("derives deterministic, salt-specific PBKDF2 verifiers", async () => {
    const firstSalt = createLockedChatSalt();
    const secondSalt = createLockedChatSalt();
    const first = await deriveLockedChatPinVerifier("123456", {
      salt: firstSalt,
      iterations: LOCKED_CHAT_PBKDF2_ITERATIONS,
    });
    const repeated = await deriveLockedChatPinVerifier("123456", {
      salt: firstSalt,
      iterations: LOCKED_CHAT_PBKDF2_ITERATIONS,
    });
    const differentSalt = await deriveLockedChatPinVerifier("123456", {
      salt: secondSalt,
      iterations: LOCKED_CHAT_PBKDF2_ITERATIONS,
    });

    expect(first).toBe(repeated);
    expect(first).not.toBe(differentSalt);
    expect(first).not.toContain("123456");
  }, 20_000);

  it("rejects weakened KDF parameters", async () => {
    await expect(deriveLockedChatPinVerifier("123456", {
      salt: createLockedChatSalt(),
      iterations: 100,
    })).rejects.toThrow("configuration is invalid");
  });
});
