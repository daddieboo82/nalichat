import { GraduationCap, Sliders, Disc3, PenLine, Drum, Mic2, TrendingUp, UserCircle } from "lucide-react";

const TOPICS = [
  { label: "Mixing", icon: Sliders },
  { label: "Mastering", icon: Disc3 },
  { label: "Songwriting", icon: PenLine },
  { label: "Beat Making", icon: Drum },
  { label: "Using the Studio", icon: Mic2 },
  { label: "Growing Your Fanbase", icon: TrendingUp },
  { label: "Profile", icon: UserCircle },
];

export default function TutorialTopics({ onPick }) {
  return (
    <div className="mt-6 text-left">
      <div className="flex items-center gap-2 mb-3 justify-center">
        <GraduationCap className="w-4 h-4 text-accent" />
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Nali can teach you</p>
      </div>
      <p className="text-[11px] text-muted-foreground text-center mb-3 max-w-[280px] mx-auto leading-relaxed">
        Pick a subject and Nali will walk you through a step-by-step tutorial.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {TOPICS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => onPick(`Give me a step-by-step beginner tutorial on ${label} in NaliChat. Keep it clear and actionable.`)}
            className="flex items-center gap-2 text-xs bg-secondary/50 hover:bg-accent/10 border border-border hover:border-accent/40 text-foreground px-3 py-2.5 rounded-xl transition-all group"
          >
            <span className="text-accent group-hover:scale-110 transition-transform"><Icon className="w-4 h-4" /></span>
            <span className="text-left font-medium leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}