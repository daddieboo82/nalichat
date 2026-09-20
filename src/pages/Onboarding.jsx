import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Music, UserRound, MapPin, CalendarDays, MessageSquare, Files, Sparkles } from "lucide-react";
import { toast } from "sonner";
import OnboardingNaliGuide from "@/components/onboarding/OnboardingNaliGuide";
import { trackProductEvent } from "@/lib/productAnalytics";

export default function Onboarding() {
  const { user, checkUserAuth, isAuthenticated } = useAuth();
  
  const [form, setForm] = useState({
    display_name: "",
    birthdate: "",
    bio: "",
    location: ""
  });
  const [formOwnerId, setFormOwnerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

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

  const handleSave = async () => {
    const submittingUserId = user?.id;
    if (!submittingUserId || formOwnerId !== submittingUserId) {
      toast.error("Your account changed. Please wait for setup to reload.");
      return;
    }
    if (!form.display_name || !form.birthdate) {
      toast.error("Please fill in your name and birthdate");
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("completeOnboarding", {
        display_name: form.display_name,
        birthdate: form.birthdate,
        bio: form.bio,
        location: form.location,
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

      // Hard redirect only after the authenticated session reflects onboarding.
      window.location.href = "/";
    } catch (error) {
      toast.error(error.message || "Failed to complete setup");
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

  const profileComplete = !!(form.display_name && form.birthdate);

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
            <p className="font-heading font-bold text-lg leading-tight">Welcome to NaliChat</p>
            <p className="text-xs text-muted-foreground">Set up your creator profile in under a minute, then jump straight into NaliChat.</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2" aria-label="Setup progress"><div className="h-1.5 rounded-full bg-primary" /><div className="h-1.5 rounded-full bg-primary/25" /><div className="h-1.5 rounded-full bg-primary/25" /></div><div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="What you can do after setup">{[[MessageSquare,"Message"],[Music,"Create"],[Files,"Share files"],[Sparkles,"Use AI"]].map(([Icon,label]) => <div key={label} className="rounded-xl border border-border/60 bg-secondary/20 px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground"><Icon className="mx-auto mb-1 h-4 w-4 text-primary" aria-hidden="true" />{label}</div>)}</div><div className="space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-primary" aria-hidden="true" />Display Name <span className="text-primary">*</span></label>
            <Input
              value={form.display_name}
              onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="What should we call you?"
            className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />Birthdate <span className="text-primary">*</span></label>
            <Input
              type="date"
              value={form.birthdate}
              onChange={(e) => setForm(f => ({ ...f, birthdate: e.target.value }))}
            className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Bio <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="A short bio about your music (optional)"
              rows={3}
            className="min-h-[88px] resize-y rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" aria-hidden="true" />Location <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input
              value={form.location}
              onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="City, Country"
            className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
          </div>
          <p className="rounded-xl bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">Only your display name and birthdate are required. Bio and location are optional and can be added later in Settings.</p><Button onClick={handleSave} disabled={loading} className="ui-hover mt-2 min-h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/15" size="lg">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {loading ? "Saving..." : "Enter NaliChat"}
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}