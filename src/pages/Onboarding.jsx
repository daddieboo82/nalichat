import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRight, CheckCircle2, Music, Users, PlaySquare } from "lucide-react";
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
  const [step, setStep] = useState(1);

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

  const handleNextStep = () => {
    if (step === 1) {
      if (!form.display_name || !form.birthdate) {
        toast.error("Please fill in required fields (Name and Birthdate)");
        return;
      }
      setStep(2);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await base44.auth.updateMe({
        display_name: form.display_name,
        birthdate: form.birthdate,
        bio: form.bio,
        location: form.location,
        onboarding_completed: true
      });
      
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
    <OnboardingNaliGuide step={step} profileComplete={profileComplete} />
    <div className="flex min-h-screen items-center justify-center bg-background p-4 lg:justify-start lg:pl-[6%] xl:pl-[12%]">
      <div className="w-full max-w-md bg-card border rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            {step === 1 ? <Music className="w-5 h-5 text-primary" /> : <Users className="w-5 h-5 text-primary" />}
          </div>
          <div>
            <p className="font-heading font-bold text-lg leading-tight">
              {step === 1 ? "Tell us about you" : "Almost done"}
            </p>
            <p className="text-xs text-muted-foreground">Step {step} of 2</p>
          </div>
        </div>

        {step === 1 ? (
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
            <Button onClick={handleNextStep} className="w-full mt-2" size="lg">
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bio</label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="A short bio about your music (optional)"
                rows={3}
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
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={loading} className="flex-1" size="lg">
                Back
              </Button>
              <Button onClick={handleSave} disabled={loading} className="flex-1" size="lg">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Finish
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}