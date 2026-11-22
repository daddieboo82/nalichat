import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { clearPersistedAuthTokens, markAuthActivity, persistAuthResult } from "@/lib/authSession";
import { captureMarketingAttribution, getMarketingAttribution } from "@/lib/adAttribution";
import { trackPaywallEvent } from "@/lib/paywallAnalytics";
import { trackProductEvent } from "@/lib/productAnalytics";
import { signInWithProvider } from "@/lib/authMfaFlow";
import MfaFlow from "@/components/MfaFlow";
import { MfaScreen } from "@/components/MfaParts";
import {
  otpErrorMessage,
  registrationErrorMessage,
  authenticationHttpStatus,
  resendOtpErrorMessage,
  googleLoginErrorMessage,
} from "@/lib/authErrorMessages";

export default function Register() {
  const isNativeIos = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === "ios";
  // Keep paid-plan intent visible throughout registration; account creation
  // remains free and never starts a charge.
  const returnDestination = safeReturnTo();
  const returnUrl = new URL(returnDestination, window.location.origin);
  const selectedPlan = returnUrl.pathname.toLowerCase() === "/pricing" ? returnUrl.searchParams.get("plan") : null;
  const paidSignup = selectedPlan === "premium" || selectedPlan === "premium_plus";
  const selectedPlanLabel = selectedPlan === "premium_plus" ? "Premium Plus" : "Premium";
  const signupPlanContext = paidSignup ? { plan: selectedPlan, billing_period: returnUrl.searchParams.get("billing") === "annual" ? "annual" : "monthly" } : {};
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [emailStartedTracked, setEmailStartedTracked] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const markEmailRegistrationStarted = () => {
    if (emailStartedTracked) return;
    setEmailStartedTracked(true);
    // Distinguish visitors who begin interacting with the form from people
    // who only view the registration page and leave before submitting.
    trackProductEvent("registration_form_interaction", {
      source: "email_form",
      stage: "first_field_interaction",
    });
  };

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  // Capture campaign parameters even when an ad links directly to /register.
  useEffect(() => {
    captureMarketingAttribution();
    const attribution = getMarketingAttribution();
    trackPaywallEvent("registration_view", {
      ...signupPlanContext,
      source: "register",
      campaign_source: attribution?.utm_source || undefined,
      campaign_medium: attribution?.utm_medium || undefined,
      campaign_name: attribution?.utm_campaign || undefined,
      campaign_term: attribution?.utm_term || undefined,
      campaign_content: attribution?.utm_content || undefined,
      campaign_landing_path: attribution?.landing_path || undefined,
      google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const attribution = getMarketingAttribution();
    if (!emailStartedTracked) setEmailStartedTracked(true);
    trackPaywallEvent("registration_started", {
      ...signupPlanContext,
      source: "email",
      campaign_source: attribution?.utm_source || undefined,
      campaign_medium: attribution?.utm_medium || undefined,
      campaign_name: attribution?.utm_campaign || undefined,
      campaign_term: attribution?.utm_term || undefined,
      campaign_content: attribution?.utm_content || undefined,
      campaign_landing_path: attribution?.landing_path || undefined,
      google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
    });
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await base44.auth.register({ email: normalizedEmail, password });
      setEmail(normalizedEmail);
      setOtpCode("");
      setResendCooldown(30);
      setShowOtp(true);
    } catch (err) {
      const safeReason = registrationErrorMessage(err);
      const httpStatus = authenticationHttpStatus(err);
      trackPaywallEvent("registration_failed", {
      ...signupPlanContext,
        source: "email",
        outcome: httpStatus !== null && httpStatus >= 500 ? "register_server_error" : "register_error",
        http_status: httpStatus || undefined,
        reason: safeReason,
        campaign_source: attribution?.utm_source || undefined,
        campaign_medium: attribution?.utm_medium || undefined,
        campaign_name: attribution?.utm_campaign || undefined,
        campaign_term: attribution?.utm_term || undefined,
        campaign_content: attribution?.utm_content || undefined,
        campaign_landing_path: attribution?.landing_path || undefined,
        google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
      });
      setError(safeReason);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (loading || resending || otpCode.trim().length !== 6) return;
    setError("");
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedOtp = otpCode.trim();
      const result = await base44.auth.verifyOtp({ email: normalizedEmail, otpCode: normalizedOtp });
      // Two-factor accounts finish the second step before any redirect.
      if (result?.mfa_required) {
        setMfaChallenge(result);
        setLoading(false);
        return;
      }
      const token = persistAuthResult(result);
      // Never redirect without a session: that lands the new user in a logged-out app.
      if (!token) {
        setNeedsLogin(true);
        setLoading(false);
        return;
      }
      base44.auth.setToken(token);
      markAuthActivity();
      const attribution = getMarketingAttribution();
      trackPaywallEvent("registration_completed", {
      ...signupPlanContext,
        source: "email_otp",
        campaign_source: attribution?.utm_source || undefined,
        campaign_medium: attribution?.utm_medium || undefined,
        campaign_name: attribution?.utm_campaign || undefined,
        campaign_term: attribution?.utm_term || undefined,
        campaign_content: attribution?.utm_content || undefined,
        campaign_landing_path: attribution?.landing_path || undefined,
        google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
      });
      try { sessionStorage.setItem("is_new_user", "true"); } catch {}
      window.location.href = safeReturnTo();
    } catch (err) {
      const attribution = getMarketingAttribution();
      const otpReason = otpErrorMessage(err);
      const otpOutcome = /expired/i.test(otpReason)
        ? "otp_expired"
        : /invalid/i.test(otpReason)
          ? "otp_invalid"
          : /too many/i.test(otpReason)
            ? "otp_rate_limited"
            : "otp_unknown_error";
      trackPaywallEvent("registration_failed", {
      ...signupPlanContext,
        source: "email_otp",
        outcome: otpOutcome,
        reason: otpReason,
        campaign_source: attribution?.utm_source || undefined,
        campaign_medium: attribution?.utm_medium || undefined,
        campaign_name: attribution?.utm_campaign || undefined,
        campaign_term: attribution?.utm_term || undefined,
        campaign_content: attribution?.utm_content || undefined,
        campaign_landing_path: attribution?.landing_path || undefined,
        google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
      });
      setError(otpReason);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending || loading) return;
    setResending(true);
    setError("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await base44.auth.resendOtp(normalizedEmail);
      trackProductEvent("otp_resend_success", { source: "email_otp" });
      setOtpCode("");
      setResendCooldown(30);
      toast({
        title: "New code sent",
        description: "Use the newest 6-digit code in your email. Older codes may no longer work.",
      });
    } catch (err) {
      const attribution = getMarketingAttribution();
      trackPaywallEvent("registration_failed", {
      ...signupPlanContext,
        source: "email_otp",
        outcome: "otp_resend_error",
        reason: resendOtpErrorMessage(err),
        campaign_source: attribution?.utm_source || undefined,
        campaign_medium: attribution?.utm_medium || undefined,
        campaign_name: attribution?.utm_campaign || undefined,
        campaign_term: attribution?.utm_term || undefined,
        campaign_content: attribution?.utm_content || undefined,
        campaign_landing_path: attribution?.landing_path || undefined,
        google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
      });
      setError(resendOtpErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError("");
    try {
      const attribution = getMarketingAttribution();
      trackPaywallEvent("registration_started", {
      ...signupPlanContext,
        source: "google",
        campaign_source: attribution?.utm_source || undefined,
        campaign_medium: attribution?.utm_medium || undefined,
        campaign_name: attribution?.utm_campaign || undefined,
        campaign_term: attribution?.utm_term || undefined,
        campaign_content: attribution?.utm_content || undefined,
        campaign_landing_path: attribution?.landing_path || undefined,
        google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
      });
      try {
        sessionStorage.setItem("is_new_user", "true");
        sessionStorage.setItem("registration_pending_method", "google");
      } catch {}
      clearPersistedAuthTokens();
      markAuthActivity();
      await Promise.resolve(signInWithProvider("google", safeReturnTo()));
    } catch (err) {
      const attribution = getMarketingAttribution();
      const msg = googleLoginErrorMessage(err);
      trackPaywallEvent("registration_failed", {
      ...signupPlanContext,
        source: "google",
        outcome: "oauth_launch_error",
        reason: msg,
        campaign_source: attribution?.utm_source || undefined,
        campaign_medium: attribution?.utm_medium || undefined,
        campaign_name: attribution?.utm_campaign || undefined,
        campaign_term: attribution?.utm_term || undefined,
        campaign_content: attribution?.utm_content || undefined,
        campaign_landing_path: attribution?.landing_path || undefined,
        google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
      });
      setError(msg);
      setGoogleLoading(false);
    }
  };

  if (mfaChallenge) {
    return <MfaScreen><MfaFlow challenge={mfaChallenge} returnTo={safeReturnTo()} /></MfaScreen>;
  }

  if (needsLogin) {
    return (
      <AuthLayout icon={Mail} title="Email verified" subtitle="Log in to continue with your verified email address.">
        <Button asChild className="h-12 w-full rounded-xl font-semibold">
          <Link to={`/login?returnTo=${encodeURIComponent(returnDestination)}`}>Log in</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`We sent a code to ${email}`}
      >
        {error && (
          <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive">
            {error}
          </div>
        )}
        <div className="mb-6 flex justify-center overflow-x-auto px-1 py-1">
          <InputOTP
            maxLength={6}
            aria-label="6-digit verification code"
            inputMode="numeric"
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup className="gap-1.5 sm:gap-2">
              <InputOTPSlot className="h-12 w-10 rounded-xl border sm:w-12" index={0} />
              <InputOTPSlot className="h-12 w-10 rounded-xl border sm:w-12" index={1} />
              <InputOTPSlot className="h-12 w-10 rounded-xl border sm:w-12" index={2} />
              <InputOTPSlot className="h-12 w-10 rounded-xl border sm:w-12" index={3} />
              <InputOTPSlot className="h-12 w-10 rounded-xl border sm:w-12" index={4} />
              <InputOTPSlot className="h-12 w-10 rounded-xl border sm:w-12" index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="ui-hover h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/10"
          onClick={handleVerify}
          disabled={loading || resending || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Didn't receive the code?{" "}
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || loading || resending}
            className="ui-hover min-h-9 rounded-lg px-2 py-1 font-medium text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
          </button>
        </p>
        <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
          Codes expire. If your code has expired, use Resend code above when the countdown ends. If you requested more than one code, enter only the newest one.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowOtp(false);
            setOtpCode("");
            setError("");
            setResendCooldown(0);
          }}
          disabled={loading || resending}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
        >
          Change email address
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title={paidSignup ? `Create your account for ${selectedPlanLabel}` : "Join NaliBase free"}
      subtitle={paidSignup ? "Verify your email to return to your selected plan. You can decide whether to subscribe there." : "No payment required."}
      footer={
        <>
          Already have an account?{" "}
          <Link to={`/login?returnTo=${encodeURIComponent(safeReturnTo())}`} className="ui-hover rounded-lg px-1 py-1 font-medium text-primary hover:bg-primary/10">
            Log in
          </Link>
        </>
      }
    >
      {!isNativeIos && <Button
        variant="outline"
        className="ui-hover mb-3 h-14 w-full rounded-xl bg-white text-sm font-bold text-black shadow-lg hover:bg-white/90"
        onClick={handleGoogle}
        disabled={googleLoading || loading}
        aria-busy={googleLoading ? "true" : undefined}
      >
        {googleLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Connecting to Google...
          </>
        ) : (
          <>
            <GoogleIcon className="w-5 h-5 mr-2" />
            Join free with Google
          </>
        )}
      </Button>}


      {!isNativeIos && <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or sign up with email</span>
        </div>
      </div>}

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby="registration-email-hint"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); markEmailRegistrationStarted(); }}
              className="h-12 rounded-xl border-border/70 bg-background/70 pl-10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <p id="registration-email-hint" className="text-xs text-muted-foreground">We’ll email you a 6-digit code.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); markEmailRegistrationStarted(); }}
              className="h-12 rounded-xl border-border/70 bg-background/70 pl-10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Use a long, unique password.</p>
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary focus-visible:ring-2 focus-visible:ring-primary/40" aria-pressed={showPassword}>
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            {showPassword ? "Hide passwords" : "Show passwords"}
          </button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); markEmailRegistrationStarted(); }}
              aria-describedby={confirmPassword ? "registration-password-match" : undefined}
              aria-invalid={Boolean(confirmPassword && confirmPassword !== password)}
              className="h-12 rounded-xl border-border/70 bg-background/70 pl-10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          {confirmPassword && <p id="registration-password-match" className={`text-xs ${confirmPassword === password ? "text-accent" : "text-destructive"}`} role="status">
            {confirmPassword === password ? "Passwords match." : "Passwords do not match yet."}
          </p>}
        </div>
        <Button type="submit" className="ui-hover h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/10" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
      <button
        type="button"
        onClick={() => {
          const normalizedEmail = email.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setError("Enter the email address where your verification code was sent.");
            return;
          }
          setEmail(normalizedEmail);
          setOtpCode("");
          setError("");
          // No new registration request is made. PayPal billing is not involved.
          // The code still must pass Base44's standard OTP verification.
          setResendCooldown(0);
          setShowOtp(true);
        }}
        disabled={loading || googleLoading}
        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
      >
        I already have a verification code
      </button>
    </AuthLayout>
  );
}