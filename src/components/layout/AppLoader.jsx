import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/branding/Logo";

const BARS = 20;

export default function AppLoader({ onDone }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("intro"); // intro | loading | done
  const [bars, setBars] = useState(new Array(BARS).fill(0));
  const startRef = useRef(Date.now());

  // play premium startup chime (programmatic — no network dependency, no autoplay block)
  useEffect(() => {
    import("@/hooks/use-sound").then(({ sounds }) => sounds.startup()).catch(() => {});
  }, []);

  // animate equalizer bars — throttled to ~12fps so the splash doesn't hog
  // the main thread while the app boots (keeps startup responsive).
  useEffect(() => {
    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random()));
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // progress ramp: 0→85 in 400ms, then 85→100 in 200ms, 200ms exit
  useEffect(() => {
    let v = 0;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      if (elapsed < 400) {
        v = Math.min(85, (elapsed / 400) * 85);
      } else {
        v = Math.min(100, 85 + ((elapsed - 400) / 200) * 15);
      }
      setProgress(Math.round(v));
      if (v >= 100) {
        clearInterval(interval);
        setPhase("done");
        setTimeout(onDone, 200);
      }
    }, 30);
    setTimeout(() => setPhase("loading"), 100);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          key="loader"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "hsl(240 10% 3%)" }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          {/* Ambient blobs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-[100px] animate-float-blob" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-accent/15 blur-[100px] animate-float-blob" style={{ animationDelay: "4s" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-pink-500/10 blur-[80px] animate-float-blob" style={{ animationDelay: "8s" }} />
          </div>

          {/* Scan-line overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(240 10% 3% / 0.07) 2px, hsl(240 10% 3% / 0.07) 4px)"
          }} />

          {/* Main content */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-8"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* Logo */}
            <div className="relative">
              <motion.div
                className="rounded-3xl flex items-center justify-center shadow-2xl"
                animate={{ boxShadow: ["0 0 30px hsl(285 90% 55% / 0.45)", "0 0 60px hsl(285 90% 55% / 0.75)", "0 0 30px hsl(285 90% 55% / 0.45)"] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                <Logo size={80} glow={false} />
              </motion.div>
              {/* Rotating ring */}
              <motion.div
                className="absolute -inset-3 rounded-3xl border-2 border-primary/30"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                style={{ borderTopColor: "hsl(265 80% 60%)", borderRightColor: "transparent", borderBottomColor: "transparent" }}
              />
            </div>

            {/* Word mark */}
            <div className="text-center">
              <h1 className="text-4xl font-heading font-black text-gradient-animate tracking-tight">NaliChat</h1>
              <p className="text-xs text-muted-foreground/60 mt-1 tracking-widest uppercase">Music Collaboration</p>
            </div>

            {/* Equalizer bars */}
            <div className="flex items-end gap-1 h-10">
              {bars.map((v, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 rounded-full"
                  animate={{ height: `${Math.max(6, v * 40)}px` }}
                  transition={{ duration: 0.08 }}
                  style={{
                    background: `hsl(${265 + i * 4} 80% ${55 + v * 20}%)`,
                    opacity: 0.7 + v * 0.3,
                  }}
                />
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-48">
              <div className="h-0.5 bg-border/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, hsl(265 80% 60%), hsl(340 80% 60%), hsl(175 70% 45%))",
                  }}
                  transition={{ ease: "linear" }}
                />
              </div>
              <p className="text-center text-[10px] text-muted-foreground/40 mt-2 font-mono">{progress}%</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}