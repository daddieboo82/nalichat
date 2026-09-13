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
          className="fixed inset-0 z-[100] flex min-h-[100dvh] items-start sm:items-center justify-center overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] bg-background py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
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
            className="ui-hover absolute right-3 top-[max(.75rem,env(safe-area-inset-top))] z-50 flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-md transition-all hover:bg-card/90 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 sm:right-6 sm:top-6"
          >
            Skip intro
            <X className="w-4 h-4" />
          </button>

          {/* Back button */}
          {step > 0 && (
            <button
              onClick={handlePrev}
              className="ui-hover absolute left-3 top-[max(.75rem,env(safe-area-inset-top))] z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-card/70 text-muted-foreground backdrop-blur-md transition-all hover:bg-card/90 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 sm:left-6 sm:top-1/2 sm:h-12 sm:w-12 sm:-translate-y-1/2 sm:rounded-full"
              aria-label="Previous step"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          )}

          {/* Main content */}
          <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-8 pt-20 sm:px-10 sm:py-0">
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
                  className="relative mb-6 sm:mb-8"
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
                  className={`mb-4 bg-gradient-to-r ${current.gradient} bg-clip-text font-heading text-3xl font-black leading-[1.05] tracking-tight text-transparent sm:mb-5 sm:text-5xl md:text-6xl`}
                >
                  {current.title}
                </motion.h1>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mb-7 max-w-2xl text-sm leading-relaxed text-foreground/80 sm:mb-10 sm:text-lg md:text-xl"
                >
                  {current.description}
                </motion.p>

                {/* Step-specific content */}
                {current.stats && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mb-7 grid w-full max-w-lg grid-cols-3 gap-2 sm:mb-10 sm:gap-8"
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
                    className="mb-7 grid w-full max-w-2xl grid-cols-2 gap-2 sm:mb-10 sm:grid-cols-4 sm:gap-4"
                  >
                    {current.features.map((feat) => {
                      const FeatureIcon = feat.icon;
                      return (
                        <div key={feat.label} className="ui-surface flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-card/40 p-3 backdrop-blur-xl sm:p-4">
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
                      className={`ui-hover h-14 w-full rounded-2xl bg-gradient-to-r ${current.gradient} px-8 text-lg font-bold shadow-xl transition-all hover:opacity-90 sm:w-auto`}
                    >
                      <Sparkles className="w-5 h-5 mr-2" />
                      Get Started
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <button
                      onClick={handleLogin}
                      className="ui-hover min-h-11 w-full rounded-xl px-3 text-center text-sm font-medium text-muted-foreground transition-colors hover:bg-card/50 hover:text-foreground sm:w-auto"
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
                      className={`ui-hover h-14 w-full rounded-2xl bg-gradient-to-r ${current.gradient} px-8 text-lg font-bold shadow-xl transition-all hover:opacity-90 sm:w-auto`}
                    >
                      Continue
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Progress indicator */}
            <div className="mt-7 flex justify-center gap-1 sm:mt-12">
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