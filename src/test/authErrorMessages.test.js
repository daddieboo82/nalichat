import { describe, expect, it } from 'vitest';
import {
  googleLoginErrorMessage,
  loginErrorMessage,
  otpErrorMessage,
  registrationErrorMessage,
  authenticationHttpStatus,
  resendOtpErrorMessage,
  resetPasswordErrorMessage,
} from '@/lib/authErrorMessages';

describe('safe auth error messages', () => {
  it('maps known auth failures to useful messages', () => {
    expect(loginErrorMessage(new Error('401 invalid credentials'))).toBe('Invalid email or password.');
    expect(registrationErrorMessage(new Error('user already exists'))).toContain('already exists');
    expect(otpErrorMessage(new Error('otp expired'))).toContain('expired');
    expect(otpErrorMessage(new Error('Too many verification attempts'))).toContain('Too many verification attempts');
    expect(otpErrorMessage({ response: { data: { message: '429 rate limit' } } })).toContain('Too many verification attempts');
    expect(resendOtpErrorMessage(new Error('429 rate limit'))).toContain('wait');
    expect(googleLoginErrorMessage(new Error('popup closed'))).toContain('canceled');
    expect(resetPasswordErrorMessage(new Error('reset token expired'))).toContain('expired');
  });

  it('identifies platform registration HTTP 500 without exposing raw errors', () => {
    const error = {
      message: 'Request failed with status code 500',
      response: { status: 500, data: { message: 'sensitive internal provider stacktrace' } },
    };
    expect(authenticationHttpStatus(error)).toBe(500);
    expect(registrationErrorMessage(error)).toContain('server error');
    expect(registrationErrorMessage(error)).toContain('Google');
    expect(registrationErrorMessage(error)).not.toContain('sensitive internal provider stacktrace');
    expect(authenticationHttpStatus({ response: { status: 429 } })).toBe(429);
    expect(authenticationHttpStatus(new Error('offline'))).toBeNull();
  });

  it('does not echo unknown provider/internal errors', () => {
    const internal = 'postgres constraint auth_users_email_key violated';
    expect(loginErrorMessage(new Error(internal))).not.toContain(internal);
    expect(registrationErrorMessage(new Error(internal))).not.toContain(internal);
    expect(otpErrorMessage(new Error(internal))).not.toContain(internal);
    expect(resetPasswordErrorMessage(new Error(internal))).not.toContain(internal);
  });
});
