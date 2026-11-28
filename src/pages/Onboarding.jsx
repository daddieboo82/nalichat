import React, { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Music, UserRound, MapPin, CalendarDays, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import OnboardingNaliGuide from "@/components/onboarding/OnboardingNaliGuide";
import { trackProductEvent } from "@/lib/productAnalytics";
import { onboardingLoginPath, safeReturnTo } from "@/lib/authReturnTo";

const PROFILE_LIMITS = { display_name: 120, bio: 2000, location: 200 };

function LengthHint({ id, value, limit }) {
  const remaining = limit - value.length;
  return (
    <p id={id} className={remaining > 20 ? "sr-only" : "text-xs text-muted-foreground"}>
      {remaining > 20 ? `Maximum ${limit} characters.`
        : remaining < 0 ? `${-remaining} over the ${limit}-character limit.`
        : remaining === 0 ? `${limit}-character limit reached.`
        : `${remaining} of ${limit} characters left.`}
    </p>
  );
}

function destinationAfterSetup() {
  const destination = safeReturnTo();
  const { pathname } = new URL(destination, window.location.origin);
  return /^\/onboarding\/*$/i.test(pathname) ? "/" : destination;
}

export default function Onboarding() {
  const { user, isAuthenticated } = useAuth();
  if (isAuthenticated && user?.id && user.onboarding_completed === true) {
    return <Navigate to={destinationAfterSetup()} replace />;
  }
  return <OnboardingForm />;
}

function OnboardingForm() {
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
  const saveInFlightRef = useRef(null);
  const activeUserIdRef = useRef(user?.id);
  activeUserIdRef.current = user?.id;
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [savedProfileOwner, setSavedProfileOwner] = useState(null);
  const [setupError, setSetupError] = useState("");
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
      if (formOwnerId === user.id && onboardingInteractionTracked) return;
      if (formOwnerId !== user.id) {
        // A previous account's pending save must not lock this account's form.
        saveInFlightRef.current = null;
        setLoading(false);
        setSavedProfileOwner(null);
        setOnboardingInteractionTracked(false);
        setFieldError(null);
        setSetupError("");
        setShowOptionalDetails(false);
        setValidationRecovery(false);
      }
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
      // Invalidate pending completion requests before redirecting away. Their
      // eventual success or failure must not update a later signed-in account.
      saveInFlightRef.current = null;
      setLoading(false);
      setSavedProfileOwner(null);
      setFormOwnerId(null);
      window.location.href = onboardingLoginPath();
    }
  }, [user, isAuthenticated, formOwnerId, onboardingInteractionTracked]);

  useEffect(() => {
    if (showOptionalDetails && fieldError?.field === "birthdate") {
      birthdateInput.current?.focus();
    }
  }, [showOptionalDetails, fieldError]);

  const hasOptionalEdits = form.birthdate !== (user?.birthdate || "") ||
    form.bio !== (user?.bio || "") ||
    form.location !== (user?.location || "");

  const profileSaved = Boolean(user?.id && savedProfileOwner === user.id);

  const handleSave = async (displayNameOnly = false) => {
    // A second tap in the same event cycle must not dispatch twice.
    if (loading || saveInFlightRef.current) return;
    setValidationRecovery(false);
    setFieldError(null);
    setSetupError("");
    const submittingUserId = user?.id;
    if (!submittingUserId || formOwnerId !== submittingUserId) {
      toast.error("Your account changed. Please wait for setup to reload.");
      return;
    }
    const displayName = form.display_name.trim();
    if (!profileSaved && !displayName) {
      trackProductEvent("onboarding_validation_blocked", { source: "profile_setup", user_id: submittingUserId, reason: "missing_display_name" });
      setFieldError({ field: "display_name", message: "Please enter your display name." });
      displayNameInput.current?.focus();
      return;
    }
    // The backend accepts only a real YYYY-MM-DD birthdate that is not in
    // the future. Validate locally so mobile users receive a useful message
    // instead of an opaque HTTP 400 during onboarding.
    if (!profileSaved && !displayNameOnly && form.birthdate) {
      const parsed = new Date(form.birthdate + "T00:00:00Z");
      const today = new Date();
      const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthdate) ||
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== form.birthdate ||
          parsed.getTime() > todayUtc) {
        trackProductEvent("onboarding_validation_blocked", { source: "profile_setup", user_id: submittingUserId, reason: "invalid_birthdate" });
        setFieldError({ field: "birthdate", message: "Enter a valid birthdate that is not in the future, or leave it blank." });
        setShowOptionalDetails(true);
        return;
      }
    }

    const saveAttempt = { userId: submittingUserId };
    saveInFlightRef.current = saveAttempt;
    const stillCurrentAttempt = () => activeUserIdRef.current === submittingUserId && saveInFlightRef.current === saveAttempt;
    setLoading(true);
    // Once the backend confirms the profile, later auth-refresh failures
    // must not be presented as a failed save to the creator.
    let profileWriteConfirmed = profileSaved;
    try {
      if (!profileSaved) {
        trackProductEvent("onboarding_submit", { source: "profile_setup", user_id: submittingUserId, mode: displayNameOnly ? "name_only" : "full_form" });
        const res = await base44.functions.invoke("completeOnboarding", {
          display_name: displayName,
          birthdate: displayNameOnly ? "" : form.birthdate,
          bio: displayNameOnly ? (user.bio || "") : form.bio,
          location: displayNameOnly ? (user.location || "") : form.location,
        });
        if (!stillCurrentAttempt()) return;
        if (res?.data?.error) throw new Error(res.data.error);
        if (
          res?.data?.success !== true ||
          res?.data?.action !== "complete_onboarding" ||
          res?.data?.userId !== submittingUserId ||
          res?.data?.onboardingCompleted !== true
        ) throw new Error("Profile setup was not confirmed");
        profileWriteConfirmed = true;
        setSavedProfileOwner(submittingUserId);
        trackProductEvent("onboarding_profile_saved", {
          source: "profile_setup",
          user_id: submittingUserId,
        });
      }

      if (!stillCurrentAttempt()) return;
      const refreshedUser = await checkUserAuth();
      if (!stillCurrentAttempt()) return;
      if (
        !refreshedUser?.id ||
        refreshedUser.id !== submittingUserId ||
        refreshedUser.onboarding_completed !== true
      ) {
        throw new Error("Your profile is saved. Select Continue to retry opening NaliBase.");
      }
      
      trackProductEvent("onboarding_complete", {
        user_id: submittingUserId,
        source: "profile_setup",
      });

      // SPA navigation — the auth state is already refreshed in React context
      // (checkUserAuth confirmed onboarding_completed), so a full page reload
      // would just re-download JS and re-run the auth probe for nothing.
      const destination = destinationAfterSetup();
      navigate(destination, {
        replace: true,
        state: destination === "/" ? { setupCompletedBy: submittingUserId } : undefined,
      });
    } catch (error) {
      if (!stillCurrentAttempt()) return;
      const httpStatus = Number(error?.response?.status ?? error?.status ?? 0);
      const isBadRequest = httpStatus === 400 || /status code 400/.test(String(error?.message || ""));
      const errorDetail = error?.response?.data?.error || error?.data?.error || error?.message || "Failed to complete setup";
      const message = profileWriteConfirmed
        ? "Your profile is saved. Select Continue to retry opening NaliBase."
        : typeof errorDetail === "string" ? errorDetail : "Failed to complete setup";
      trackProductEvent(profileWriteConfirmed ? "onboarding_session_refresh_failed" : "onboarding_save_failed", {
        source: "profile_setup",
        user_id: submittingUserId,
        reason: profileWriteConfirmed ? "session_refresh_failed_after_save" : isBadRequest ? "request_rejected" : "save_or_session_failed",
      });
      setSetupError(message);
      setValidationRecovery(!profileWriteConfirmed && isBadRequest && !displayNameOnly);
    } finally {
      if (stillCurrentAttempt()) {
        saveInFlightRef.current = null;
        setLoading(false);
      }
    }
  };

  if (initializing || (user?.id && formOwnerId !== user.id)) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const returningToSetup = user?.onboarding_completed !== true &&
    Date.parse(user?.created_date) <= Date.now() - 24 * 60 * 60 * 1000;

  const detailsVisible = showOptionalDetails && !profileSaved;
  const submitSection = (
    <>
      {setupError && <p className="text-sm text-destructive" role="alert">{setupError}</p>}
      <Button type="submit" disabled={loading} className="ui-hover min-h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/15" size="lg">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
        {loading ? "Continuing..." : profileSaved ? "Continue" : "Enter NaliBase"}
      </Button>
    </>
  );

  return (
    <>
    <div className="flex min-h-screen min-h-[100dvh] items-start sm:items-center justify-center overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] lg:justify-start lg:pl-[6%] xl:pl-[12%]">
      <div className="ui-surface w-full max-w-lg rounded-3xl border border-border/80 bg-card/90 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20">
            <Music className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-heading font-bold text-lg leading-tight">Welcome to NaliBase</p>
            <p className="text-xs text-muted-foreground">Use your display name to finish setup and enter the NaliBase Plaza. You can add profile details later.</p>
          </div>
        </div>

        <OnboardingNaliGuide />

        {returningToSetup && (
          <p className="mb-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm">
            Welcome back. Finish your profile below whenever you’re ready.
          </p>
        )}
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          void handleSave(!showOptionalDetails && !hasOptionalEdits);
        }}>
          <div className="space-y-1.5">
            <label htmlFor="setup-display-name" className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-primary" aria-hidden="true" />Display Name <span className="text-primary">*</span></label>
            <Input
              id="setup-display-name"
              maxLength={PROFILE_LIMITS.display_name}
              ref={displayNameInput}
              readOnly={profileSaved}
              autoComplete="nickname"
              enterKeyHint="go"
              aria-required="true"
              aria-invalid={fieldError?.field === "display_name"}
              aria-describedby={fieldError?.field === "display_name" ? "setup-display-name-error setup-display-name-length" : "setup-display-name-length"}
              value={form.display_name}
              onChange={(e) => { markOnboardingInteraction(); setFieldError(error => error?.field === "display_name" ? null : error); setForm(f => ({ ...f, display_name: e.target.value })); }}
              placeholder="What should we call you?"
            className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
            <LengthHint id="setup-display-name-length" value={form.display_name} limit={PROFILE_LIMITS.display_name} />
          </div>
          {fieldError?.field === "display_name" && (
            <p id="setup-display-name-error" role="alert" className="text-sm text-destructive">{fieldError.message}</p>
          )}
          {!detailsVisible && submitSection}
          <button
            type="button"
            aria-expanded={detailsVisible}
            aria-controls="setup-optional-details"
            disabled={loading || profileSaved}
            onClick={() => setShowOptionalDetails(open => !open)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/70 px-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Optional profile details
            <ChevronDown aria-hidden="true" className={showOptionalDetails ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
          </button>
          <div id="setup-optional-details" hidden={!detailsVisible} className="space-y-4">
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
              <div>
                <p id="setup-birthdate-error" role="alert" className="text-sm text-destructive">{fieldError.message}</p>
                <Button type="button" variant="outline" className="mt-2 min-h-11 rounded-xl" onClick={() => {
                  setForm(current => ({ ...current, birthdate: "" }));
                  setFieldError(null);
                  birthdateInput.current?.focus();
                }}>
                  Remove birthdate
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="setup-bio" className="text-sm font-semibold">Bio <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Textarea
                id="setup-bio"
                maxLength={PROFILE_LIMITS.bio}
                aria-describedby="setup-bio-length"
                value={form.bio}
                onChange={(e) => { markOnboardingInteraction(); setForm(f => ({ ...f, bio: e.target.value })); }}
                placeholder="A short bio about your music (optional)"
                rows={3}
              className="min-h-[88px] resize-y rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
              <LengthHint id="setup-bio-length" value={form.bio} limit={PROFILE_LIMITS.bio} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="setup-location" className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" aria-hidden="true" />Location <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Input
                id="setup-location"
                maxLength={PROFILE_LIMITS.location}
                aria-describedby="setup-location-length"
                enterKeyHint="go"
                value={form.location}
                onChange={(e) => { markOnboardingInteraction(); setForm(f => ({ ...f, location: e.target.value })); }}
                placeholder="City, Country"
              className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
              <LengthHint id="setup-location-length" value={form.location} limit={PROFILE_LIMITS.location} />
            </div>
          </div>
          {detailsVisible && submitSection}
          {validationRecovery && (
            <div role="alert" className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <p>Profile details were not accepted. You can try again with only your required display name. Optional information will not be saved in that attempt.</p>
              <Button type="button" variant="outline" disabled={loading} className="min-h-11 w-full" onClick={() => handleSave(true)}>Finish with display name only</Button>
            </div>
          )}
          {!profileSaved && !showOptionalDetails && hasOptionalEdits && !validationRecovery && (
            <Button type="button" variant="outline" disabled={loading} className="min-h-11 w-full" onClick={() => handleSave(true)}>
              Finish with display name only
            </Button>
          )}
        </form>
      </div>
    </div>
    </>
  );
}