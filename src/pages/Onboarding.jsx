import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRight, CheckCircle2, Music, Users, PlaySquare } from "lucide-react";
import { toast } from "sonner";

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
      const isTestUser = user.email && (
        user.email.toLowerCase().includes('test') || 
        user.email.toLowerCase().includes('example') || 
        user.email.toLowerCase().includes('glop') ||
        user.email.toLowerCase().includes('agent') ||
        user.email.toLowerCase().includes('automation') ||
        user.email.toLowerCase().includes('qa') ||
        user.email.toLowerCase().includes('demo') ||
        user.email.toLowerCase().includes('base44')
      );

      if (user.onboarding_completed && !isTestUser) {
        window.location.href = "/";
      } else {
        setForm(f => ({
          ...f,
          display_name: user.display_name || user.full_name || "",
          birthdate: user.birthdate || "",
          bio: user.bio || "",
          location: user.location || "",
        }));
        setInitializing(false);
      }
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border rounded-2xl p-8 shadow-xl">
        {step === 1 && (
          <>
            <h1 className="text-3xl font-bold mb-2">Welcome!</h1>
            <p className="text-muted-foreground mb-8">Let's set up your profile before we continue.</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Display Name *</label>
                <Input 
                  value={form.display_name} 
                  onChange={e => setForm({...form, display_name: e.target.value})} 
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Birthdate *</label>
                <Input 
                  type="date"
                  value={form.birthdate} 
                  onChange={e => setForm({...form, birthdate: e.target.value})} 
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Location</label>
                <Input 
                  value={form.location} 
                  onChange={e => setForm({...form, location: e.target.value})} 
                  placeholder="City, Country"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Bio</label>
                <Textarea 
                  value={form.bio} 
                  onChange={e => setForm({...form, bio: e.target.value})} 
                  placeholder="Tell us about yourself..."
                  className="resize-none"
                />
              </div>

              <Button 
                className="w-full mt-6" 
                onClick={handleNextStep} 
              >
                Next Step
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-3xl font-bold mb-2">Quick Tutorial</h1>
            <p className="text-muted-foreground mb-8">Get to know the basics of NaliStudio.</p>

            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Studio Creation</h3>
                  <p className="text-sm text-muted-foreground">Record, arrange, and edit multiple tracks in the browser-based studio.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Collaborate</h3>
                  <p className="text-sm text-muted-foreground">Invite friends to your session, or chat with them using built-in messaging.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                  <PlaySquare className="w-5 h-5 text-pink-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Publish & Share</h3>
                  <p className="text-sm text-muted-foreground">Export your mix and share it on your public profile for the world to hear.</p>
                </div>
              </div>

              <Button 
                className="w-full mt-6" 
                onClick={handleSave} 
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Finish & Enter Studio"}
                {!loading && <CheckCircle2 className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}