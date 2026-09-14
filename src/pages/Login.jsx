import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "sonner";
import { safeReturnTo } from "@/lib/authReturnTo";
import { clearPersistedAuthTokens, markAuthActivity, persistAuthResult } from "@/lib/authSession";
import { googleLoginErrorMessage, loginErrorMessage } from "@/lib/authErrorMessages";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.loginViaEmailPassword(email, password);
      const token = persistAuthResult(result);
      if (token) {
        base44.auth.setToken(token);
      }
      // A successful login starts a fresh activity window. Without this, a
      // stale 24-hour inactivity timestamp can immediately log the user out again.
      markAuthActivity();
      // Skip the intro splash after login so the user lands straight in the app
      try { sessionStorage.setItem('nali_splash_shown', '1'); } catch {}
      toast.success("Logged in successfully! Welcome back.");
      window.location.href = safeReturnTo();
    } catch (err) {
      const msg = loginErrorMessage(err);
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError("");
    try {
      // Login must not inherit a pending registration marker from an abandoned Google signup.
      try { sessionStorage.removeItem("registration_pending_method"); } catch {}
      // A stale bearer token can override a fresh cookie-backed Google session
      // on the callback and make auth.me() report the user as logged out.
      clearPersistedAuthTokens();
      markAuthActivity();
      await Promise.resolve(base44.auth.loginWithProvider("google", safeReturnTo()));
    } catch (err) {
      const msg = googleLoginErrorMessage(err);
      setError(msg);
      toast.error(msg);
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Pick up where you left off in NaliChat."
      footer={
        <>
          Don't have an account?{" "}
          <Link to={`/register?returnTo=${encodeURIComponent(safeReturnTo())}`} className="ui-hover min-h-9 rounded-lg px-2 py-1 font-medium text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40">
            Create one
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="ui-hover mb-6 h-12 w-full rounded-xl text-sm font-semibold"
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
            Continue with Google
          </>
        )}
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 space-y-1 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive">
          <p>{error}</p>
          <p className="text-muted-foreground">
            If you originally signed up with Google, use "Continue with Google" above instead of a password. Otherwise, try "Forgot password?" to set one.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4"><p className="rounded-xl bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">Use the same sign-in method you used when you created your account.</p>
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
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl border-border/70 bg-background/70 pl-10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="ui-hover inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border-border/70 bg-background/70 pl-10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
        </div>
        <Button type="submit" className="ui-hover h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/10" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}