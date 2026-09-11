import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, UserCircle, Trophy, ArrowRight, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sounds } from "@/hooks/use-sound";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to NaliChat!",
    description: "Let's get you set up in two quick steps so you can start collaborating with other artists.",
    primary: { label: "Let's Go", action: "next" },
    color: "from-primary to-pink-500",
  },
  {
    icon: UserCircle,
    title: "Complete Your Profile",
    description: "Add your avatar, bio, and genres so other artists can discover and connect with you. It takes 30 seconds.",
    primary: { label: "Go to Settings", action: "navigate", path: "/settings" },
    secondary: { label: "Next", action: "next" },
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: Trophy,
    title: "Join Your First Challenge",
    description: "Browse active remix challenges, download the source track, and submit your remix to the community.",
    primary: { label: "Browse Challenges", action: "navigate", path: "/challenges" },
    secondary: { label: "Maybe Later", action: "complete" },
    color: "from-yellow-500 to-orange-500",
  },
];

export default function WelcomeTour({ open, onClose }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const Icon = current.icon;

  const complete = async () => {
    try { await base44.functions.invoke("updateMyProfile", { welcome_tour_completed: true }); } catch {}
  };

  const handleAction = async (action, path) => {
    sounds.click();
    if (action === "next") {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } else if (action === "navigate") {
      await complete();
      onClose();
      navigate(path);
    } else if (action === "complete") {
      await complete();
      onClose();
    }
  };

  const handleDismiss = async () => {
    await complete();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-card border border-border rounded-3xl overflow-hidden shadow-2xl"
          >
            <button
              onClick={handleDismiss}
              className="absolute right-4 top-4 z-10 text-muted-foreground hover:text-foreground p-2 transition-colors"
              aria-label="Dismiss tour"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-8 sm:p-10 text-center">
              <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${current.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                <Icon className="w-10 h-10 text-white" />
              </div>
              <h2 className="font-heading font-black text-2xl mb-3">{current.title}</h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">{current.description}</p>

              <div className="space-y-3">
                <Button
                  onClick={() => handleAction(current.primary.action, current.primary.path)}
                  className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90"
                >
                  {current.primary.label} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                {current.secondary && (
                  <button
                    onClick={() => handleAction(current.secondary.action, current.secondary.path)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {current.secondary.label}
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-center gap-2 pb-8">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-primary" : "w-1.5 bg-muted"}`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}