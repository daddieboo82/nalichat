import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Music } from "lucide-react";
import { toast } from "sonner";
import OnboardingNaliGuide from "@/components/onboarding/OnboardingNaliGuide";

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
      <div className="ui-surface w-full max-w-md rounded-3xl border border-border/80 bg-card/90 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20">
            <Music className="w-5 h-5 text-primary" className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <p className="font-heading font-bold text-lg leading-tight">Welcome to NaliChat</p>
            <p className="text-xs text-muted-foreground">Let's set up your profile</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Display Name *</label>
            <Input
              value={form.display_name}
              onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="What should we call you?"
            className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Birthdate *</label>
            <Input
              type="date"
              value={form.birthdate}
              onChange={(e) => setForm(f => ({ ...f, birthdate: e.target.value }))}
            className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Bio</label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="A short bio about your music (optional)"
              rows={2}
            className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Location</label>
            <Input
              value={form.location}
              onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="City, Country (optional)"
            className="min-h-11 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
          </div>
          <Button onClick={handleSave} disabled={loading} className="ui-hover mt-2 min-h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/15" size="lg">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {loading ? "Saving..." : "Get Started"}
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}