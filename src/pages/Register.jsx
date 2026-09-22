import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { clearPersistedAuthTokens, markAuthActivity, persistAuthResult } from "@/lib/authSession";
import { captureMarketingAttribution, getMarketingAttribution } from "@/lib/adAttribution";
import { trackPaywallEvent } from "@/lib/paywallAnalytics";
import { trackProductEvent } from "@/lib/productAnalytics";
import {
  otpErrorMessage,
  registrationErrorMessage,
  resendOtpErrorMessage,
  googleLoginErrorMessage,
} from "@/lib/authErrorMessages";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailStartedTracked, setEmailStartedTracked] = useState(false);

  const markEmailRegistrationStarted = () => {
    if (emailStartedTracked) return;
    setEmailStartedTracked(true);
    trackProductEvent("registration_started", { source: "email", stage: "form_interaction" });
  };

  // Capture campaign parameters even when an ad links directly to /register.
  useEffect(() => {
    captureMarketingAttribution();
    const attribution = getMarketingAttribution();
    trackProductEvent("registration_view", { source: "register" });
    trackPaywallEvent("registration_view", {
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
    if (!emailStartedTracked) {
      setEmailStartedTracked(true);
      trackProductEvent("registration_started", { source: "email", stage: "submit" });
    }
    trackPaywallEvent("registration_started", {
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
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      const safeReason = registrationErrorMessage(err);
      trackProductEvent("registration_failed", { source: "email", outcome: "register_error", reason: safeReason });
      trackPaywallEvent("registration_failed", {
        source: "email",
        outcome: "register_error",
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
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      const token = persistAuthResult(result);
      if (token) {
        base44.auth.setToken(token);
      }
      markAuthActivity();
      const attribution = getMarketingAttribution();
      trackProductEvent("registration_completed", { source: "email_otp" });
      trackPaywallEvent("registration_completed", {
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
      trackProductEvent("registration_failed", { source: "email_otp", outcome: "otp_error" });
      trackPaywallEvent("registration_failed", {
        source: "email_otp",
        outcome: "otp_error",
        campaign_source: attribution?.utm_source || undefined,
        campaign_medium: attribution?.utm_medium || undefined,
        campaign_name: attribution?.utm_campaign || undefined,
        campaign_term: attribution?.utm_term || undefined,
        campaign_content: attribution?.utm_content || undefined,
        campaign_landing_path: attribution?.landing_path || undefined,
        google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
      });
      setError(otpErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      const attribution = getMarketingAttribution();
      trackPaywallEvent("registration_failed", {
        source: "email_otp",
        outcome: "otp_resend_error",
        campaign_source: attribution?.utm_source || undefined,
        campaign_medium: attribution?.utm_medium || undefined,
        campaign_name: attribution?.utm_campaign || undefined,
        campaign_term: attribution?.utm_term || undefined,
        campaign_content: attribution?.utm_content || undefined,
        campaign_landing_path: attribution?.landing_path || undefined,
        google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
      });
      setError(resendOtpErrorMessage(err));
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError("");
    try {
      const attribution = getMarketingAttribution();
      trackProductEvent("registration_started", { source: "google" });
      trackPaywallEvent("registration_started", {
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
      await Promise.resolve(base44.auth.loginWithProvider("google", safeReturnTo()));
    } catch (err) {
      const attribution = getMarketingAttribution();
      trackProductEvent("registration_failed", { source: "google", outcome: "oauth_launch_error" });
      trackPaywallEvent("registration_failed", {
        source: "google",
        outcome: "oauth_launch_error",
        campaign_source: attribution?.utm_source || undefined,
        campaign_medium: attribution?.utm_medium || undefined,
        campaign_name: attribution?.utm_campaign || undefined,
        campaign_term: attribution?.utm_term || undefined,
        campaign_content: attribution?.utm_content || undefined,
        campaign_landing_path: attribution?.landing_path || undefined,
        google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
      });
      const msg = googleLoginErrorMessage(err);
      setError(msg);
      setGoogleLoading(false);
    }
  };

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
          disabled={loading || otpCode.length < 6}
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
          <button onClick={handleResend} className="ui-hover min-h-9 rounded-lg px-2 py-1 font-medium text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Join NaliChat free"
      subtitle="Start with Google in one tap, or use your email. No payment required."
      footer={
        <>
          Already have an account?{" "}
          <Link to={`/login?returnTo=${encodeURIComponent(safeReturnTo())}`} className="ui-hover rounded-lg px-1 py-1 font-medium text-primary hover:bg-primary/10">
            Log in
          </Link>
        </>
      }
    >
      <Button
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
      </Button>

      <p className="mb-5 text-center text-xs font-medium text-muted-foreground">Fastest option · No password to create · Free core messaging + NaliStudio</p>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or sign up with email</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4"><p className="rounded-xl bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">Email signup takes about a minute. We’ll send one 6-digit verification code.</p>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); markEmailRegistrationStarted(); }}
              className="h-12 rounded-xl border-border/70 bg-background/70 pl-10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); markEmailRegistrationStarted(); }}
              className="h-12 rounded-xl border-border/70 bg-background/70 pl-10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); markEmailRegistrationStarted(); }}
              className="h-12 rounded-xl border-border/70 bg-background/70 pl-10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
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
    </AuthLayout>
  );
}