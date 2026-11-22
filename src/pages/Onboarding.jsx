import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Music, UserRound, MapPin, CalendarDays, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import OnboardingNaliGuide from "@/components/onboarding/OnboardingNaliGuide";
import { trackProductEvent } from "@/lib/productAnalytics";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Onboarding() {
  const { user, checkUserAuth, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    display_name: "",
    birthdate: "",
    bio: "",
    location: ""
  });
  const [formOwnerId, setFormOwnerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const displayNameInput = useRef(null);
  const birthdateInput = useRef(null);
  const [validationRecovery, setValidationRecovery] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [onboardingInteractionTracked, setOnboardingInteractionTracked] = useState(false);

  useEffect(() => {
    if (!user?.id || user.onboarding_completed === true) return;
    trackProductEvent("onboarding_view", { source: "profile_setup", user_id: user.id });
  }, [user?.id, user?.onboarding_completed]);

  const markOnboardingInteraction = () => {
    if (onboardingInteractionTracked) return;
    setOnboardingInteractionTracked(true);
    trackProductEvent("onboarding_form_interaction", {
      source: "profile_setup",
      stage: "first_field_interaction",
      user_id: user?.id,
    });
  };

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        display_name: user.display_name || user.full_name || "",
        birthdate: user.birthdate || "",
        bio: user.bio || "",
        location: user.location || "",
      }));
      setFormOwnerId(user.id);
      setInitializing(false);
    } else if (isAuthenticated === false) {
        setFormOwnerId(null);
        window.location.href = "/login";
    }
  }, [user, isAuthenticated]);

  const handleSave = async (displayNameOnly = false) => {
    if (loading) return;
    setValidationRecovery(false);
    setFieldError(null);
    const submittingUserId = user?.id;
    if (!submittingUserId || formOwnerId !== submittingUserId) {
      toast.error("Your account changed. Please wait for setup to reload.");
      return;
    }
    const displayName = form.display_name.trim();
    if (!displayName) {
      trackProductEvent("onboarding_validation_blocked", { source: "profile_setup", user_id: submittingUserId, reason: "missing_display_name" });
      setFieldError({ field: "display_name", message: "Please enter your display name." });
      displayNameInput.current?.focus();
      return;
    }
    // The backend accepts only a real YYYY-MM-DD birthdate that is not in
    // the future. Validate locally so mobile users receive a useful message
    // instead of an opaque HTTP 400 during onboarding.
    if (!displayNameOnly && form.birthdate) {
      const parsed = new Date(form.birthdate + "T00:00:00Z");
      const today = new Date();
      const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthdate) ||
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== form.birthdate ||
          parsed.getTime() > todayUtc) {
        trackProductEvent("onboarding_validation_blocked", { source: "profile_setup", user_id: submittingUserId, reason: "invalid_birthdate" });
        setFieldError({ field: "birthdate", message: "Enter a valid birthdate that is not in the future, or leave it blank." });
        birthdateInput.current?.focus();
        return;
      }
    }
    trackProductEvent("onboarding_submit", { source: "profile_setup", user_id: submittingUserId, mode: displayNameOnly ? "name_only" : "full_form" });
    setLoading(true);
    try {
      const res = await base44.functions.invoke("completeOnboarding", {
        display_name: displayName,
        birthdate: displayNameOnly ? "" : form.birthdate,
        bio: displayNameOnly ? (user.bio || "") : form.bio,
        location: displayNameOnly ? (user.location || "") : form.location,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "complete_onboarding" ||
        res?.data?.userId !== submittingUserId ||
        res?.data?.onboardingCompleted !== true
      ) throw new Error("Profile setup was not confirmed");
      
      const refreshedUser = await checkUserAuth();
      if (
        !refreshedUser?.id ||
        refreshedUser.id !== submittingUserId ||
        refreshedUser.onboarding_completed !== true
      ) {
        throw new Error("Profile setup saved, but your session did not refresh. Please try again.");
      }
      
      trackProductEvent("onboarding_complete", {
        user_id: submittingUserId,
        source: "profile_setup",
      });

      // SPA navigation — the auth state is already refreshed in React context
      // (checkUserAuth confirmed onboarding_completed), so a full page reload
      // would just re-download JS and re-run the auth probe for nothing.
      const destination = safeReturnTo();
      // Never loop back into setup after it has completed.
      navigate(new URL(destination, window.location.origin).pathname.toLowerCase() === "/onboarding" ? "/" : destination, { replace: true });
    } catch (error) {
      const httpStatus = Number(error?.response?.status ?? error?.status ?? 0);
      const isBadRequest = httpStatus === 400 || /status code 400/.test(String(error?.message || ""));
      const errorDetail = error?.response?.data?.error || error?.data?.error || error?.message || "Failed to complete setup";
      const message = typeof errorDetail === "string" ? errorDetail : "Failed to complete setup";
      trackProductEvent("onboarding_save_failed", {
        source: "profile_setup",
        user_id: submittingUserId,
        reason: isBadRequest ? "request_rejected" : "save_or_session_failed",
      });
      toast.error(message);
      setValidationRecovery(isBadRequest && !displayNameOnly);
      setLoading(false);
    }
  };

  if (initializing || (user?.id && formOwnerId !== user.id)) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const profileComplete = !!form.display_name;
  const returningToSetup = user?.onboarding_completed !== true &&
    Date.parse(user?.created_date) <= Date.now() - 24 * 60 * 60 * 1000;

  return (
    <>
    <OnboardingNaliGuide step={1} profileComplete={profileComplete} />
    <div className="flex min-h-screen min-h-[100dvh] items-start sm:items-center justify-center overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] lg:justify-start lg:pl-[6%] xl:pl-[12%]">
      <div className="ui-surface w-full max-w-lg rounded-3xl border border-border/80 bg-card/90 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20">
            <Music className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-heading font-bold text-lg leading-tight">Welcome to NaliBase</p>
            <p className="text-xs text-muted-foreground">Finish setup with your display name. You can add profile details later.</p>
          </div>
        </div>

        {returningToSetup && (
          <p className="mb-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm">
            Welcome back. Finish your profile below whenever you’re ready.
          </p>
        )}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="setup-display-name" className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-primary" aria-hidden="true" />Display Name <span className="text-primary">*</span></label>
            <Input
              id="setup-display-name"
              ref={displayNameInput}
              aria-required="true"
              aria-invalid={fieldError?.field === "display_name"}
              aria-describedby={fieldError?.field === "display_name" ? "setup-display-name-error" : undefined}
              value={form.display_name}
              onChange={(e) => { markOnboardingInteraction(); setFieldError(error => error?.field === "display_name" ? null : error); setForm(f => ({ ...f, display_name: e.target.value })); }}
              placeholder="What should we call you?"
            className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
          </div>
          {fieldError?.field === "display_name" && (
            <p id="setup-display-name-error" role="alert" className="text-sm text-destructive">{fieldError.message}</p>
          )}
          <button
            type="button"
            aria-expanded={showOptionalDetails}
            aria-controls="setup-optional-details"
            disabled={loading}
            onClick={() => setShowOptionalDetails(open => !open)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/70 px-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Optional profile details
            <ChevronDown aria-hidden="true" className={showOptionalDetails ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
          </button>
          <div id="setup-optional-details" hidden={!showOptionalDetails} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="setup-birthdate" className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />Birthdate <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Input
                id="setup-birthdate"
                ref={birthdateInput}
                aria-invalid={fieldError?.field === "birthdate"}
                aria-describedby={fieldError?.field === "birthdate" ? "setup-birthdate-error" : undefined}
                type="date"
                value={form.birthdate}
                onChange={(e) => { markOnboardingInteraction(); setFieldError(error => error?.field === "birthdate" ? null : error); setForm(f => ({ ...f, birthdate: e.target.value })); }}
              className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
            </div>
            {fieldError?.field === "birthdate" && (
              <p id="setup-birthdate-error" role="alert" className="text-sm text-destructive">{fieldError.message}</p>
            )}
            <div className="space-y-1.5">
              <label htmlFor="setup-bio" className="text-sm font-semibold">Bio <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Textarea
                id="setup-bio"
                value={form.bio}
                onChange={(e) => { markOnboardingInteraction(); setForm(f => ({ ...f, bio: e.target.value })); }}
                placeholder="A short bio about your music (optional)"
                rows={3}
              className="min-h-[88px] resize-y rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="setup-location" className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" aria-hidden="true" />Location <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Input
                id="setup-location"
                value={form.location}
                onChange={(e) => { markOnboardingInteraction(); setForm(f => ({ ...f, location: e.target.value })); }}
                placeholder="City, Country"
              className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          {showOptionalDetails && validationRecovery && (
            <div role="alert" className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <p>Profile details were not accepted. You can try again with only your required display name. Optional information will not be saved in that attempt.</p>
              <Button type="button" variant="outline" disabled={loading} className="min-h-11 w-full" onClick={() => handleSave(true)}>Finish with display name only</Button>
            </div>
          )}
          <Button onClick={() => handleSave(!showOptionalDetails)} disabled={loading} className="ui-hover mt-2 min-h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/15" size="lg">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {loading ? "Saving..." : "Enter NaliBase"}
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}