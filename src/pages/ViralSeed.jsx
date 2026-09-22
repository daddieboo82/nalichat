import { useState, useEffect, useRef } from "react";
import { Rocket, Sparkles, Loader2, RefreshCw, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ViralConceptCard from "@/components/viralseed/ViralConceptCard";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/AuthContext";

const MOODS = [
  { id: "humor", label: "😂 Funny" },
  { id: "shock", label: "😮 Shock" },
  { id: "curiosity", label: "🤔 Curiosity" },
  { id: "relatable", label: "🫶 Relatable" },
  { id: "controversy", label: "🔥 Controversy" },
  { id: "awe", label: "✨ Awe" },
];

export default function ViralSeed() {
  const { hasEntitlement } = useSubscription();
  const { user } = useAuth();
  const canUseAi = hasEntitlement("ai.standard");
  const generationRef = useRef(0);
  const xpTimerRef = useRef(null);
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState("all");
  const [error, setError] = useState(null);
  const [xpAwarded, setXpAwarded] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    generationRef.current += 1;
    if (xpTimerRef.current) {
      clearTimeout(xpTimerRef.current);
      xpTimerRef.current = null;
    }
    setConcepts([]);
    setLoading(false);
    setMood("all");
    setError(null);
    setXpAwarded(null);
  }, [user?.id]);

  useEffect(() => () => {
    if (xpTimerRef.current) clearTimeout(xpTimerRef.current);
  }, []);

  const generate = async () => {
    if (!canUseAi) {
      setError("ViralSeed AI is available with Premium. Your regular NaliBase worlds and Studio tools remain available.");
      return;
    }
    const generation = generationRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("generateViralConcepts", { mood });
      if (generation !== generationRef.current) return;
      if (res?.data?.error) throw new Error(res.data.error);
      setConcepts(res?.data?.concepts || []);
      if (res?.data?.xp_awarded) {
        setXpAwarded(res.data.xp_awarded);
        if (xpTimerRef.current) clearTimeout(xpTimerRef.current);
        xpTimerRef.current = setTimeout(() => {
          if (generation === generationRef.current) setXpAwarded(null);
          xpTimerRef.current = null;
        }, 3000);
      }
      queryClient.invalidateQueries({ queryKey: ["leaderboard-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-achievements"] });
    } catch (err) {
      if (generation === generationRef.current) {
        setError("Failed to generate viral concepts. Please try again.");
      }
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] pb-[max(5rem,env(safe-area-inset-bottom))]">
      {/* Hero */}
      <div className="relative overflow-hidden px-4 pb-6 pt-6 sm:px-6 sm:pt-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float-blob pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Rocket className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">ViralSeed AI</span>
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-gradient-animate sm:text-3xl">
            Viral Content Seeding Engine
          </h1>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground">
            Generate platform-native viral content for NaliChat — TikTok scripts, Reddit posts, Discord messages, X threads, and YouTube Shorts, all optimized for explosive growth.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[11px] font-semibold text-yellow-400">Earn +50 XP per generation</span>
          </div>
        </div>
      </div>

      {/* XP earned toast */}
      <AnimatePresence>
        {xpAwarded && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-yellow-500/90 to-amber-500/90 text-white shadow-lg shadow-yellow-500/30 backdrop-blur-sm"
          >
            <Zap className="w-4 h-4" />
            <span className="text-sm font-bold">+{xpAwarded} XP earned!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-4">
        {/* Mood selector */}
        <div className="no-scrollbar flex items-center justify-start gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible">
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">Mood:</span>
          <button
            onClick={() => setMood("all")}
            className={cn(
              "ui-hover min-h-10 shrink-0 touch-manipulation rounded-full px-3 py-1.5 text-[12px] font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/40",
              mood === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
            )}
          >
            🎲 All
          </button>
          {MOODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMood(m.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[12px] font-medium transition-all touch-manipulation",
                mood === m.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Generate button */}
        <div className="flex justify-center">
          <Button
            onClick={generate}
            disabled={loading || !canUseAi}
            size="lg"
            className="ui-hover h-12 w-full rounded-xl bg-gradient-to-r from-primary to-pink-500 px-6 font-semibold text-white shadow-lg shadow-primary/30 hover:opacity-90 sm:w-auto sm:px-8"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating viral concepts...
              </>
            ) : concepts.length > 0 ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerate Concepts
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {!canUseAi ? "Available with Premium" : "Generate 5 Viral Concepts"}
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="ui-surface rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6 space-y-4">
        {loading && concepts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Crafting viral content across platforms...</p>
          </div>
        )}

        {!loading && concepts.length === 0 && !error && (
          <div className="ui-surface flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border px-5 py-14 text-center sm:py-20">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Rocket className="w-8 h-8 text-primary/50" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Tap "Generate" to create 5 viral content concepts with platform-native scripts, hashtags, and viral loops.
            </p>
          </div>
        )}

        {concepts.map((concept, i) => (
          <ViralConceptCard key={i} concept={concept} index={i} />
        ))}
      </div>
    </div>
  );
}