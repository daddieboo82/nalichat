import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Signup usability regression", () => {
  it("keeps email and Google signup, security checks, and OTP resend", async () => {
    const source = await readFile("src/pages/Register.jsx", "utf8");
    expect(source).toContain('base44.auth.register({ email: normalizedEmail, password })');
    expect(source).toContain('base44.auth.verifyOtp({ email: normalizedEmail, otpCode: normalizedOtp })');
    expect(source).toContain('base44.auth.resendOtp(normalizedEmail)');
    expect(source).toContain('signInWithProvider("google", safeReturnTo())');
    expect(source).toContain('showPassword ? "text" : "password"');
    expect(source).toContain('aria-pressed={showPassword}');
    expect(source).toContain('Codes expire. If your code has expired');
    expect(source).toContain('disabled={resendCooldown > 0 || loading}');
  });
});