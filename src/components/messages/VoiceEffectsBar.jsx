import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOUNDBOARD_SOUNDS } from "@/lib/soundboard";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

const FILTERS = [
  { id: "original", label: "Original" },
  { id: "deep", label: "Deep" },
  { id: "bright", label: "Bright" },
  { id: "robot", label: "Robot" },
  { id: "echo", label: "Echo" },
  { id: "lofi", label: "Lo-Fi" },
];

export default function VoiceEffectsBar({ activeFilter, onFilterChange, duetMode, onDuetChange, audioCtxRef }) {
  const { reduceMotion } = useReducedMotionPreference();
  const playSound = (sound) => {
    let ctx = audioCtxRef?.current;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    sound.play(ctx);
  };

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
      {/* Filter presets */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-1 shrink-0">Filter</span>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all touch-manipulation min-h-[28px]",
              activeFilter === f.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Duet + Soundboard row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Duet toggle — cycles: off → high → low → off */}
        <button
          onClick={() => onDuetChange(duetMode === "off" ? "high" : duetMode === "high" ? "low" : "off")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all touch-manipulation min-h-[28px] shrink-0",
            duetMode !== "off"
              ? "bg-accent text-accent-foreground shadow-sm"
              : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Users className="w-3 h-3" />
          {duetMode === "off" ? "Duet" : duetMode === "high" ? "Duet: High" : "Duet: Low"}
        </button>

        {/* Soundboard reaction triggers */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-1 shrink-0">Reactions</span>
          {SOUNDBOARD_SOUNDS.map((s) => (
            <button
              key={s.id}
              onClick={() => playSound(s)}
              className={cn(
                "w-7 h-7 rounded-full bg-secondary/60 hover:bg-primary/20 flex items-center justify-center text-sm transition-all touch-manipulation",
                !reduceMotion && "hover:scale-110 active:scale-95"
              )}
              title={s.label}
              aria-label={s.label}
            >
              {s.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}