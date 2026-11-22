import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

import { safeReturnTo } from "@/lib/authReturnTo";

export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState(() => typeof location.state?.email === "string" ? location.state.email : "");
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const address = email.trim();
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(address);
    } catch {
      // Always show success regardless
    } finally {
      setLoading(false);
      setSubmittedEmail(address);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title={submittedEmail ? "Check your inbox" : "Reset password"}
      subtitle={submittedEmail ? undefined : "Enter the email you use to sign in."}
      footer={
        <Link to={`/login?returnTo=${encodeURIComponent(safeReturnTo())}`} className="ui-hover inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-primary hover:bg-primary/10">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in
        </Link>
      }
    >
      {submittedEmail ? (
        <div className="space-y-4 text-center">
          <div role="status" className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm leading-relaxed">
            <p>If an account exists for <strong className="break-all">{submittedEmail}</strong>, you’ll receive a password reset link.</p>
            <p className="mt-2 text-muted-foreground">Check your spam folder if the link hasn’t arrived.</p>
          </div>
          <Button type="button" variant="outline" className="h-12 w-full rounded-xl" onClick={() => {
            setEmail(submittedEmail);
            setSubmittedEmail("");
          }}>
            Edit email address
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-border/70 bg-background/70 pl-10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                readOnly={loading}
                required
              />
            </div>
          </div>
          <Button type="submit" className="ui-hover h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/10" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
