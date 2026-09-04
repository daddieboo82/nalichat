import { useState } from "react";
import { Rocket, Sparkles, Loader2, RefreshCw, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ViralConceptCard from "@/components/viralseed/ViralConceptCard";

const MOODS = [
  { id: "humor", label: "😂 Funny" },
  { id: "shock", label: "😮 Shock" },
  { id: "curiosity", label: "🤔 Curiosity" },
  { id: "relatable", label: "🫶 Relatable" },
  { id: "controversy", label: "🔥 Controversy" },
  { id: "awe", label: "✨ Awe" },
];

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          hook: { type: "string" },
          emotional_trigger: { type: "string" },
          tiktok_script: { type: "string" },
          reddit_post: { type: "string" },
          discord_message: { type: "string" },
          x_thread: { type: "string" },
          youtube_shorts_script: { type: "string" },
          viral_loop: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          communities: { type: "array", items: { type: "string" } },
          screenshot_caption: { type: "string" },
          cta: { type: "string" },
        },
      },
    },
  },
};

function buildPrompt(mood) {
  return `You are ViralSeed AI — an autonomous engine that creates, optimizes, and distributes viral content for NaliChat, a music collaboration platform at nalichat.org where producers, artists, and fans collaborate in real-time, mix tracks in a built-in studio, share music, and join remix challenges.

Your mission:
1. Generate 5 viral content ideas for music creators — beats, studio sessions, collaborations, music challenges, producer struggles, viral sounds, remix battles.
2. Convert each idea into platform-native formats: TikTok scripts, Reddit posts, Discord messages, X threads, YouTube Shorts scripts.
3. Identify the best communities, hashtags, and posting times for maximum early engagement.
4. Create "viral loops" that encourage users to share their results from nalichat.org.
5. Produce 3 versions of each content piece natively formatted for each platform's culture.

Rules:
- Always use emotional triggers: ${mood === "all" ? "awe, humor, anger, surprise, validation, or curiosity" : mood}.
- Always include a CTA that drives traffic back to nalichat.org.
- Always format content natively for each platform's culture.
- Always optimize for early engagement (first 30 minutes).
- Generate multiple variations so users can test what hits.

Output Format for each concept:
1. Viral Concept (title + hook)
2. TikTok/Reels Script
3. Reddit Post
4. Discord Message
5. X (Twitter) Thread
6. YouTube Shorts Script
7. Viral Loop Mechanic
8. Hashtags + Communities
9. Shareable Screenshot Caption
10. CTA to nalichat.org

Generate 5 viral concepts for nalichat.org now. Be specific, creative, and authentic to music culture.`;
}

export default function ViralSeed() {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState("all");
  const [error, setError] = useState(null);
  const [xpAwarded, setXpAwarded] = useState(null);
  const queryClient = useQueryClient();

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: buildPrompt(mood),
        response_json_schema: RESPONSE_SCHEMA,
      });
      setConcepts(res?.concepts || []);

      // Award XP and track viral generation for leaderboard
      try {
        const me = await base44.auth.me();
        const conceptCount = res?.concepts?.length || 5;
        const wasFirstGeneration = !(me.viral_concepts_generated > 0);
        await base44.auth.updateMe({
          xp: (me.xp || 0) + 50,
          viral_concepts_generated: (me.viral_concepts_generated || 0) + conceptCount,
        });
        if (wasFirstGeneration) {
          await base44.entities.Achievement.create({
            user_id: me.id,
            key: "viral_seed",
            title: "Viral Seed",
            description: "Generated your first viral content concepts with ViralSeed AI",
            icon: "rocket",
            xp: 50,
            category: "creative",
          });
        }
        setXpAwarded(50);
        setTimeout(() => setXpAwarded(null), 3000);
        queryClient.invalidateQueries({ queryKey: ["leaderboard-users"] });
        queryClient.invalidateQueries({ queryKey: ["all-achievements"] });
      } catch (xpErr) {
        // XP awarding is secondary — don't fail the whole generation
      }
    } catch (err) {
      setError("Failed to generate viral concepts. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] pb-20">
      {/* Hero */}
      <div className="relative overflow-hidden px-4 sm:px-6 pt-8 pb-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float-blob pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Rocket className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">ViralSeed AI</span>
          </div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-gradient-animate">
            Viral Content Seeding Engine
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
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
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">Mood:</span>
          <button
            onClick={() => setMood("all")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[12px] font-medium transition-all touch-manipulation",
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
            disabled={loading}
            size="lg"
            className="bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-white shadow-lg shadow-primary/30 px-8 h-12 rounded-xl"
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
                Generate 5 Viral Concepts
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="text-center text-sm text-destructive bg-destructive/10 rounded-xl py-2 px-4">
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
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
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