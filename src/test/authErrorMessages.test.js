import { describe, expect, it } from 'vitest';
import {
  googleLoginErrorMessage,
  loginErrorMessage,
  otpErrorMessage,
  registrationErrorMessage,
  resendOtpErrorMessage,
} from '@/lib/authErrorMessages';

describe('safe auth error messages', () => {
  it('maps known auth failures to useful messages', () => {
    expect(loginErrorMessage(new Error('401 invalid credentials'))).toBe('Invalid email or password.');
    expect(registrationErrorMessage(new Error('user already exists'))).toContain('already exists');
    expect(otpErrorMessage(new Error('otp expired'))).toContain('expired');
    expect(resendOtpErrorMessage(new Error('429 rate limit'))).toContain('wait');
    expect(googleLoginErrorMessage(new Error('popup closed'))).toContain('canceled');
  });

  it('does not echo unknown provider/internal errors', () => {
    const internal = 'postgres constraint auth_users_email_key violated';
    expect(loginErrorMessage(new Error(internal))).not.toContain(internal);
    expect(registrationErrorMessage(new Error(internal))).not.toContain(internal);
    expect(otpErrorMessage(new Error(internal))).not.toContain(internal);
  });
});
