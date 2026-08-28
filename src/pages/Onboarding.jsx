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
...
      </div>
    </div>
    </>
  );
}