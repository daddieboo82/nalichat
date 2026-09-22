function normalized(error) {
  return String(error?.message || error?.response?.data?.error || error?.data?.error || '').toLowerCase();
}

export function loginErrorMessage(error) {
  const msg = normalized(error);
  if (/invalid|incorrect|credential|password|unauthorized|401/.test(msg)) {
    return 'Invalid email or password.';
  }
  if (/too many|rate limit|429/.test(msg)) {
    return 'Too many login attempts. Please try again shortly.';
  }
  if (/network|fetch|timeout|timed out|connection/.test(msg)) {
    return 'Could not reach NaliBase. Check your connection and try again.';
  }
  return 'Could not log in. Please try again.';
}

export function googleLoginErrorMessage(error) {
  const msg = normalized(error);
  if (/popup|cancel|closed|denied/.test(msg)) {
    return 'Google sign-in was canceled. Please try again.';
  }
  if (/network|fetch|timeout|timed out|connection/.test(msg)) {
    return 'Could not reach Google sign-in. Check your connection and try again.';
  }
  return 'Google sign-in could not be started. Please try again.';
}

export function registrationErrorMessage(error) {
  const msg = normalized(error);
  if (/already|exists|registered|duplicate/.test(msg)) {
    return 'An account with that email already exists. Try logging in instead.';
  }
  if (/password/.test(msg) && /weak|short|length|character|require/.test(msg)) {
    return 'That password does not meet the security requirements.';
  }
  if (/email/.test(msg) && /invalid|format/.test(msg)) {
    return 'Enter a valid email address.';
  }
  if (/too many|rate limit|429/.test(msg)) {
    return 'Too many signup attempts. Please try again shortly.';
  }
  if (/network|fetch|timeout|timed out|connection/.test(msg)) {
    return 'Could not reach NaliBase. Check your connection and try again.';
  }
  return 'Could not create your account. Please try again.';
}

export function otpErrorMessage(error) {
  const msg = normalized(error);
  if (/expired/.test(msg)) return 'That verification code expired. Request a new code.';
  if (/invalid|incorrect|code|otp|verification/.test(msg)) {
    return 'That verification code is invalid. Check the code and try again.';
  }
  if (/too many|rate limit|429/.test(msg)) {
    return 'Too many verification attempts. Please try again shortly.';
  }
  return 'Could not verify the code. Please try again.';
}

export function resendOtpErrorMessage(error) {
  const msg = normalized(error);
  if (/too many|rate limit|429/.test(msg)) {
    return 'Please wait before requesting another code.';
  }
  return 'Could not resend the verification code. Please try again.';
}

export function resetPasswordErrorMessage(error) {
  const msg = normalized(error);
  if (/expired/.test(msg)) return 'This reset link has expired. Request a new link.';
  if (/invalid|token|reset link/.test(msg)) {
    return 'This reset link is invalid. Request a new link.';
  }
  if (/password/.test(msg) && /weak|short|length|character|require/.test(msg)) {
    return 'That password does not meet the security requirements.';
  }
  if (/too many|rate limit|429/.test(msg)) {
    return 'Too many reset attempts. Please try again shortly.';
  }
  if (/network|fetch|timeout|timed out|connection/.test(msg)) {
    return 'Could not reach NaliBase. Check your connection and try again.';
  }
  return 'Could not reset your password. Please request a new link and try again.';
}
