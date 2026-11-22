import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email.trim());
    } catch {
      // Always show success regardless
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="Enter the email you use to sign in."
      footer={
        <Link to="/login" className="ui-hover inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-primary hover:bg-primary/10">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in
        </Link>
      }
    >
      {sent ? (
        <div role="status" className="rounded-2xl border border-primary/20 bg-primary/10 p-5 text-center"><Mail className="mx-auto mb-3 h-8 w-8 text-primary" aria-hidden="true" /><p className="text-sm leading-relaxed text-foreground">
          If an account exists with that email, you'll receive a password reset link shortly.
        </p><p className="mt-2 text-xs text-muted-foreground">Check your inbox and spam folder. The message may take a minute to arrive.</p></div>
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
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-border/70 bg-background/70 pl-10 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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
