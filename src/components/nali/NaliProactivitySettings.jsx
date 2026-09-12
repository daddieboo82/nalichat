import { Sparkles, Bell, BellOff, BellRing } from "lucide-react";
import { useNaliPresence } from "@/lib/NaliPresenceContext";
import { cn } from "@/lib/utils";

const LEVELS = [
  { value: "proactive", label: "Proactive", desc: "Nali surfaces subtle hints & suggestions automatically across chats, media, and your profile. Never intrusive — always dismissible.", icon: BellRing },
  { value: "minimal", label: "Minimal", desc: "Nali stays quiet and only helps when you summon it.", icon: Bell },
  { value: "off", label: "Muted", desc: "Nali's presence is hidden everywhere. You can re-enable anytime.", icon: BellOff },
];

export default function NaliProactivitySettings() {
  const { level, setLevel, isSaving } = useNaliPresence();

  return (
    <div className="bg-card/50 backdrop-blur-xl rounded-2xl p-6 border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg text-foreground">Nali Presence</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Control how Nali shows up across NaliChat. Nali never interrupts — it only offers help you can dismiss.
      </p>
      <div className="space-y-2">
        {LEVELS.map(({ value, label, desc, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setLevel(value)}
            disabled={isSaving}
            className={cn(
              "w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all",
              level === value ? "border-primary/50 bg-primary/10" : "border-border hover:border-primary/30 hover:bg-secondary/50",
              isSaving && "opacity-60 cursor-wait"
            )}
          >
            <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", level === value ? "text-primary" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}