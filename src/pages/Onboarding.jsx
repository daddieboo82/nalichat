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
    location: "",
    onboarding_completed: true
  });
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
      setInitializing(false);
    } else if (isAuthenticated === false) {
        window.location.href = "/login";
    }
  }, [user, isAuthenticated]);

  const handleSave = async () => {
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
      
      await checkUserAuth();
      
      // Hard redirect to prevent router loops with stale auth state
      window.location.href = "/";
    } catch (error) {
      toast.error(error.message || "Failed to complete setup");
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const profileComplete = !!(form.display_name && form.birthdate);

  return (
    <>
    <OnboardingNaliGuide step={1} profileComplete={profileComplete} />
    <div className="flex min-h-screen items-center justify-center bg-background p-4 lg:justify-start lg:pl-[6%] xl:pl-[12%]">
      <div className="w-full max-w-md bg-card border rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Music className="w-5 h-5 text-primary" />
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
              placeholder="How should we call you?"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Birthdate *</label>
            <Input
              type="date"
              value={form.birthdate}
              onChange={(e) => setForm(f => ({ ...f, birthdate: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Bio</label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="A short bio about your music (optional)"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Location</label>
            <Input
              value={form.location}
              onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="City, Country (optional)"
            />
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full mt-2" size="lg">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {loading ? "Saving..." : "Get Started"}
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}