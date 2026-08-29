import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/hooks/use-sound';

/**
 * 3-2-1 countdown overlay shown before recording starts so no one is caught
 * mid-sentence. Plays a beep per step and a higher "go" tone, then calls onComplete.
 */
export default function RecordingCountdown({ onComplete, onCancel }) {
  const [n, setN] = useState(3);
  const doneRef = useRef(false);

  useEffect(() => {
    if (n === 0) {
      if (doneRef.current) return;
      doneRef.current = true;
      sounds.countdownGo();
      const t = setTimeout(onComplete, 250);
      return () => clearTimeout(t);
    }
    sounds.countdown();
    const t = setTimeout(() => setN(v => v - 1), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md"
    >
      <div className="absolute top-6 right-6">
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg bg-secondary/60"
        >
          Cancel
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-4 font-heading">Get ready…</p>
      <AnimatePresence mode="wait">
        <motion.div
          key={n}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="text-[120px] font-black font-mono leading-none"
          style={{
            background: 'linear-gradient(135deg, hsl(265 80% 65%), hsl(340 80% 60%))',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {n === 0 ? 'Go' : n}
        </motion.div>
      </AnimatePresence>
      <button
        onClick={onComplete}
        className="mt-6 text-xs text-primary hover:underline"
      >
        Skip
      </button>
    </motion.div>
  );
}