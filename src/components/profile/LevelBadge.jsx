import { cn } from "@/lib/utils";

const LEVEL_CONFIG = [
  { min: 1, max: 4, label: "Newcomer", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  { min: 5, max: 9, label: "Creator", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { min: 10, max: 19, label: "Artist", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { min: 20, max: 49, label: "Master", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { min: 50, max: Infinity, label: "Legend", color: "bg-red-500/20 text-red-400 border-red-500/30" },
];

export default function LevelBadge({ level }) {
  // Fall back to the lowest tier only for invalid/too-low levels — never for
  // levels above the highest defined tier, which should stay "Legend".
  const config = LEVEL_CONFIG.find(c => level >= c.min && level <= c.max)
    || (level > LEVEL_CONFIG[LEVEL_CONFIG.length - 1].max ? LEVEL_CONFIG[LEVEL_CONFIG.length - 1] : LEVEL_CONFIG[0]);
  return (
    <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full border", config.color)}>
      Lv.{level} {config.label}
    </span>
  );
}