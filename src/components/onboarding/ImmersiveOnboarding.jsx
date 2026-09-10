import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Music, Users, TrendingUp, ArrowRight,
  X, ChevronRight, MessageSquare, Wand2, Radio,
  Headphones, Star, Zap
} from "lucide-react";
import { sounds } from "@/hooks/use-sound";

const STORAGE_KEY = "nali_onboarding_seen";

const steps = [
  {
    id: "welcome",
    icon: Sparkles,
    title: "Welcome to NaliChat",
    subtitle: "The ultimate platform for music creators",
    description: "Where artists discover, create, collaborate, and share their sound with the world — all in one place.",
    gradient: "from-primary via-purple-500 to-pink-500",
    bgGradient: "from-primary/30 via-purple-600/20 to-pink-500/30",
    accent: "primary",
    stats: [
      { value: "10K+", label: "Tracks Shared" },
      { value: "50K+", label: "Active Creators" },
      { value: "100K+", label: "Conversations" },
    ],
  },
  {
    id: "studio",
    icon: Music,
    title: "Create in the Studio",
    subtitle: "A full DAW in your browser",
    description: "Record, arrange, and edit multiple tracks. Separate stems with AI, generate royalty-free samples, and master your tracks to industry standard — all without leaving your browser.",
    gradient: "from-accent via-cyan-500 to-blue-500",
    bgGradient: "from-accent/30 via-cyan-600/20 to-blue-500/30",
    accent: "accent",
    features: [
      { icon: Wand2, label: "AI Stem Engine" },
      { icon: Zap, label: "AI Mastering" },
      { icon: Music, label: "Multi-Track Recording" },
      { icon: Headphones, label: "Real-Time Mixing" },
    ],
  },
  {
    id: "collaborate",
    icon: Users,
    title: "Collaborate in Real-Time",
    subtitle: "Music is better together",
    description: "Invite friends to live jam rooms with video and audio. Chat instantly, share high-res files, and co-edit sessions together — no matter where you are.",
    gradient: "from-orange-500 via-red-500 to-pink-500",
    bgGradient: "from-orange-500/30 via-red-600/20 to-pink-500/30",
    accent: "orange",
    features: [
      { icon: Radio, label: "Live Jam Rooms" },
      { icon: MessageSquare, label: "Instant Messaging" },
      { icon: Users, label: "Co-Editing" },
      { icon: Headphones, label: "High-Res Sharing" },
    ],
  },
  {
    id: "publish",
    icon: TrendingUp,
    title: "Share & Grow",
    subtitle: "Build your audience",
    description: "Publish your tracks to the marketplace, climb the leaderboard, earn achievements, and showcase your portfolio on a stunning creator profile. AI helps you tag every track with the right BPM, genre, and key.",
    gradient: "from-green-500 via-emerald-500 to-teal-500",
    bgGradient: "from-green-500/30 via-emerald-600/20 to-teal-500/30",
    accent: "green",
    features: [
      { icon: TrendingUp, label: "Stems Marketplace" },
      { icon: Star, label: "Leaderboard Rankings" },
      { icon: Sparkles, label: "AI Cover Art" },
      { icon: Users, label: "Creator Profiles" },
    ],
  },
  {
    id: "join",
    icon: Sparkles,
    title: "Join the Movement",
    subtitle: "One plan unlocks everything",
    description: "Subscribe for full NaliChat access every 30 days, including exports, stem downloads, and desktop builds with no separate per-item charges.",
    gradient: "from-primary via-pink-500 to-accent",
    bgGradient: "from-primary/30 via-pink-600/20 to-accent/30",
    accent: "primary",
    cta: true,
  },
];

export default function ImmersiveOnboarding() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {}
    // Small delay so it feels like an intentional intro, not a flash
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    sounds.click();
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setVisible(false);
  };

  const handleNext = () => {
    sounds.click();
    if (step < steps.length - 1) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    sounds.click();
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const handleRegister = () => {
    sounds.success();
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
    navigate("/register");
  };

  const handleLogin = () => {
    sounds.click();
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
    navigate("/login");
  };

  const current = steps[step];
  const Icon = current.icon;

  const slideVariants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 60 : -60, scale: 0.95 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -60 : 60, scale: 0.95 }),
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background"
        >
          {/* Animated background blobs — unique per step */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`bg-${step}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className={`absolute -top-40 -right-40 w-[600px] h-[600px] bg-gradient-to-br ${current.bgGradient} rounded-full blur-[120px] animate-float-blob`} />
              <div className={`absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-gradient-to-br ${current.bgGradient} rounded-full blur-[120px] animate-float-blob`} style={{ animationDelay: "-5s" }} />
              <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-primary/15 rounded-full blur-[100px] animate-float-blob" style={{ animationDelay: "-9s" }} />
            </motion.div>
          </AnimatePresence>

          {/* Subtle grid overlay */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

          {/* Skip button */}
          <button
            onClick={handleDismiss}
            className="absolute top-6 right-6 z-50 flex items-center gap-1.5 px-4 py-2 rounded-full bg-card/60 backdrop-blur-md border border-white/10 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card/80 transition-all"
          >
            Skip intro
            <X className="w-4 h-4" />
          </button>

          {/* Back button */}
          {step > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-card/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card/80 hover:scale-110 transition-all"
              aria-label="Previous step"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          )}

          {/* Main content */}
          <div className="relative z-10 w-full max-w-3xl mx-auto px-6 sm:px-10">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={current.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-col items-center text-center"
              >
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15, type: "spring", bounce: 0.5 }}
                  className={`relative mb-8`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${current.gradient} blur-2xl rounded-full scale-150 opacity-50`} />
                  <div className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br ${current.gradient} flex items-center justify-center shadow-2xl border border-white/20 overflow-hidden`}>
                    <Icon className="w-12 h-12 sm:w-14 sm:h-14 text-white" />
                  </div>
                </motion.div>

                {/* Subtitle badge */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground mb-3"
                >
                  {current.subtitle}
                </motion.p>

                {/* Title */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`font-heading font-black text-4xl sm:text-5xl md:text-6xl mb-5 tracking-tight leading-[1.05] bg-gradient-to-r ${current.gradient} bg-clip-text text-transparent`}
                >
                  {current.title}
                </motion.h1>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-base sm:text-lg md:text-xl text-foreground/80 leading-relaxed max-w-2xl mb-10"
                >
                  {current.description}
                </motion.p>

                {/* Step-specific content */}
                {current.stats && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="grid grid-cols-3 gap-4 sm:gap-8 w-full max-w-lg mb-10"
                  >
                    {current.stats.map((stat) => (
                      <div key={stat.label} className="text-center">
                        <p className={`text-3xl sm:text-4xl md:text-5xl font-black bg-gradient-to-br ${current.gradient} bg-clip-text text-transparent`}>
                          {stat.value}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1 uppercase tracking-wide">{stat.label}</p>
                      </div>
                    ))}
                  </motion.div>
                )}

                {current.features && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full max-w-2xl mb-10"
                  >
                    {current.features.map((feat) => {
                      const FeatureIcon = feat.icon;
                      return (
                        <div key={feat.label} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card/40 backdrop-blur-xl border border-white/[0.06]">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${current.gradient} flex items-center justify-center`}>
                            <FeatureIcon className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-foreground/90 text-center">{feat.label}</span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}

                {/* CTA buttons */}
                {current.cta ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col sm:flex-row gap-4 items-center w-full max-w-sm mx-auto"
                  >
                    <Button
                      onClick={handleRegister}
                      size="lg"
                      className={`w-full sm:w-auto h-14 px-8 text-lg font-bold rounded-2xl bg-gradient-to-r ${current.gradient} hover:opacity-90 glow-primary transition-all hover:scale-105 shadow-xl`}
                    >
                      <Sparkles className="w-5 h-5 mr-2" />
                      Get Started
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <button
                      onClick={handleLogin}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full sm:w-auto text-center"
                    >
                      Already have an account? <span className="text-primary font-semibold">Log in</span>
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                  >
                    <Button
                      onClick={handleNext}
                      size="lg"
                      className={`h-14 px-8 text-lg font-bold rounded-2xl bg-gradient-to-r ${current.gradient} hover:opacity-90 transition-all hover:scale-105 shadow-xl`}
                    >
                      Continue
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Progress indicator */}
            <div className="flex justify-center gap-1 mt-12">
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { setDirection(i > step ? 1 : -1); setStep(i); }}
                  className="h-11 w-8 flex items-center justify-center group"
                  aria-label={`Go to step ${i + 1}`}
                  aria-current={i === step ? "step" : undefined}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 rounded-full transition-all duration-300 block ${i === step ? `w-8 bg-gradient-to-r ${current.gradient}` : "w-2 bg-muted group-hover:bg-muted-foreground/50"}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}