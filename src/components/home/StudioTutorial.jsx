import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { PlayCircle, Scissors, SlidersHorizontal, Layers, Wand2, ArrowRight, Sparkles, Plus, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const demos = [
  {
    id: "overview",
    title: "Real Studio Tour",
    description: "A genuine NaliStudio demo session with the production toolbar, timeline, waveforms, and track controls.",
    video: "/tutorials/studio-overview.webm",
    icon: Layers,
  },
  {
    id: "edit",
    title: "Play & Edit",
    description: "See real playback and editing tools in the same Studio users work in.",
    video: "/tutorials/studio-play-edit.webm",
    icon: Scissors,
  },
  {
    id: "add-track",
    title: "Add a Track",
    description: "Open the real Add Track workflow for a new vocal, audio, instrument, VCA, or folder track.",
    video: "/tutorials/studio-add-track.webm",
    icon: Plus,
  },
  {
    id: "recording",
    title: "Record a Track",
    description: "See a real track armed and recorded inside NaliStudio using the production transport controls.",
    video: "/tutorials/studio-recording.webm",
    icon: PlayCircle,
  },
  {
    id: "mixer",
    title: "Mix Your Session",
    description: "Open the production Mixer with real track strips, sends, pan, mute/solo, FX, and master controls.",
    video: "/tutorials/studio-mixer.webm",
    icon: SlidersHorizontal,
  },
  {
    id: "plugins",
    title: "Plugins & FX",
    description: "Open the actual NaliStudio plugin rack and work with track/master processing.",
    video: "/tutorials/studio-plugins.webm",
    icon: Wand2,
  },
  {
    id: "export",
    title: "Export",
    description: "See the actual Studio export flow used to bounce a finished session.",
    video: "/tutorials/studio-export.webm",
    icon: Download,
  },
];

const features = [
  { title: "Waveform Editing & Fades", icon: Scissors, desc: "Trim, split, fade, and move clips directly in the Studio timeline." },
  { title: "Mixer & Track Controls", icon: SlidersHorizontal, desc: "Control levels, pan, sends, mute/solo, plugins, and the master bus." },
  { title: "AI Mastering & Export", icon: Wand2, desc: "Polish your session and move into the real bounce/export flow." },
];

export default function StudioTutorial() {
  const [activeId, setActiveId] = useState("overview");
  const active = demos.find((demo) => demo.id === activeId) || demos[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="mb-8 text-center md:text-left">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full mb-3 uppercase tracking-widest">
          <Sparkles className="w-3 h-3" />
          Real App Experience
        </div>
        <h2 className="font-heading font-black text-3xl sm:text-4xl md:text-5xl mb-3 text-gradient-animate drop-shadow-lg">
          Master the Studio
        </h2>
        <p className="text-foreground/70 text-lg font-medium max-w-3xl">
          Watch the real NaliStudio in action. These clips were recorded from the same Studio users open inside NaliChat — not a mockup.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-black shadow-2xl aspect-video">
            <video
              key={active.video}
              src={active.video}
              autoPlay
              muted
              loop
              playsInline
              controls
              className="w-full h-full object-contain bg-black"
            />
            <div className="absolute left-3 top-3 rounded-full bg-black/65 backdrop-blur px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-2 pointer-events-none">
              <PlayCircle className="w-3.5 h-3.5 text-primary" />
              Recorded in NaliStudio
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {demos.map((demo) => {
              const Icon = demo.icon;
              return (
                <button
                  key={demo.id}
                  onClick={() => setActiveId(demo.id)}
                  className={cn(
                    "min-w-max flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                    activeId === demo.id
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", activeId === demo.id && "text-primary")} />
                  {demo.title}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
            <p className="font-semibold text-sm">{active.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{active.description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/[0.06] bg-card/50 backdrop-blur-xl p-5 flex-1">
            <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              What You Can Learn
            </h3>
            <ul className="space-y-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.title} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{feature.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <Button className="w-full rounded-xl h-14 text-base font-bold bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary shimmer-hover" asChild>
            <Link to="/studio" className="block">
              <Wand2 className="w-5 h-5 mr-2" />
              Open the Real Studio
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
