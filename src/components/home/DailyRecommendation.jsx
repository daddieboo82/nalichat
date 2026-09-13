import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Play, Sparkles, X, Music, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/hooks/use-sound";
import { getLikeCount } from "@/lib/engagement";

function sessionGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function sessionSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}

async function listAllArtPosts() {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.ArtPost.list("-created_date", pageSize, skip);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function DailyRecommendation() {
  const [post, setPost] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    // Check if already dismissed today
    const key = `nali_rec_dismissed_${new Date().toDateString()}`;
    if (sessionGet(key)) { setDismissed(true); return; }

    let cancelled = false;
    setLoadError(false);
    listAllArtPosts().then((posts) => {
      if (cancelled || !posts?.length) return;
      const topPosts = [...posts].sort((a, b) => getLikeCount(b) - getLikeCount(a)).slice(0, 20);
      // Pick a pseudo-random one from the top 20 based on day
      const idx = new Date().getDate() % topPosts.length;
      setPost(topPosts[idx]);
    }).catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => { cancelled = true; };
  }, [retryKey]);

  const dismiss = () => {
    const key = `nali_rec_dismissed_${new Date().toDateString()}`;
    sessionSet(key, "1");
    setDismissed(true);
    if (audio) { audio.pause(); audio.currentTime = 0; }
    sounds.click();
  };

  const togglePlay = async (e) => {
    e.preventDefault();
    if (!post?.file_url) return;
    sounds.click();
    if (playing) {
      audio?.pause();
      setPlaying(false);
      return;
    }

    let player = audio;
    if (!player) {
      player = new Audio(post.file_url);
      player.volume = 0.7;
      player.onended = () => setPlaying(false);
      player.onerror = () => setPlaying(false);
      setAudio(player);
    }

    try {
      await player.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  // Cleanup on unmount / player replacement.
  useEffect(() => () => {
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
    }
  }, [audio]);

  if (dismissed) return null;

  if (!post && loadError) {
    return (
      <div className="mx-6 mt-6 mb-0">
        <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Daily Pick couldn't load.</p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.4 }}
        className="mx-6 mt-6 mb-0"
      >
        <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 via-card to-primary/10 px-5 py-4 flex items-center gap-4 group">
          {/* Glow blob */}
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-accent/15 rounded-full blur-2xl pointer-events-none" />

          {/* Label */}
          <div className="shrink-0 hidden sm:flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-md shadow-accent/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Daily Pick</span>
          </div>

          {/* Cover / play */}
          <button
            onClick={togglePlay}
            className="shrink-0 relative w-12 h-12 rounded-xl overflow-hidden bg-secondary flex items-center justify-center hover:scale-105 transition-transform"
          >
            {post.image_url
              ? <img src={post.image_url} alt={post.title} className="absolute inset-0 w-full h-full object-cover" />
              : <Music className="w-5 h-5 text-muted-foreground" />}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              {playing
                ? <div className="flex items-end gap-0.5 h-4">{[...Array(4)].map((_, i) => (
                    <div key={i} className="w-1 bg-white rounded-full waveform-bar" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}</div>
                : <Play className="w-4 h-4 text-white fill-white" />}
            </div>
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium mb-0.5 sm:hidden">
              <Sparkles className="w-3 h-3 inline mr-1 text-accent" />Daily Pick
            </p>
            <Link to="/explore" onClick={() => sounds.click()}>
              <p className="font-heading font-bold text-sm hover:text-accent transition-colors line-clamp-2">{post.title}</p>
            </Link>
            <p className="text-xs text-muted-foreground truncate">{post.creator_name} · {post.genre || "Music"} · {getLikeCount(post)} likes</p>
          </div>

          {/* Explore CTA */}
          <Link
            to="/explore"
            onClick={() => sounds.click()}
            className="shrink-0 hidden sm:flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
          >
            <Play className="w-3 h-3" />
            Explore
          </Link>

          {/* Dismiss */}
          <button
            onClick={dismiss}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}