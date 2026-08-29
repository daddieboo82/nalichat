import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VolumeX, AlertTriangle, Volume2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Smart, real-time problem detection during recording. Samples the live input
 * level once per second and surfaces an actionable, non-alarming tip when a
 * common failure mode is detected.
 */
export default function RecordingTips({ level, isPaused }) {
  const [tip, setTip] = useState(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    if (isPaused) { setTip(null); return; }
    let low = 0, quiet = 0, clip = 0, good = 0;
    const iv = setInterval(() => {
      const l = levelRef.current;
      if (l < 0.005) {
        low++; quiet = 0; good = 0;
        if (low >= 8) setTip({ type: 'silent', text: "I'm not hearing any audio — check your mic is connected & unmuted, or switch devices." });
      } else if (l > 0.9) {
        clip++;
        if (clip >= 3) setTip({ type: 'clip', text: 'Your levels are hot — move back from the mic or lower input gain to avoid clipping.' });
      } else if (l < 0.04) {
        quiet++; low = 0; good = 0;
        if (quiet >= 5) setTip({ type: 'quiet', text: "You're a bit quiet — try moving closer to the mic or boosting input gain." });
      } else {
        good++; low = 0; quiet = 0; clip = 0;
        if (good >= 4) setTip({ type: 'good', text: 'Levels sound great — keep going!' });
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [isPaused]);

  const config = {
    silent: { icon: VolumeX, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
    clip: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
    quiet: { icon: Volume2, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
    good: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  }[tip?.type];

  return (
    <div className="h-10 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {tip && config && (
          <motion.div
            key={tip.type}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={cn('flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-medium', config.bg, config.color)}
          >
            <config.icon className="w-3.5 h-3.5 shrink-0" />
            <span>{tip.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}