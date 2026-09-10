import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Play, Scissors, SlidersHorizontal, Layers, Wand2, ArrowRight, Sparkles } from "lucide-react";

// A stylized, honestly-labeled preview of the Studio's own visual language
// (waveform lanes + a mixer fader) rather than a video. The previous version
// of this component played a 6-second placeholder clip from base44's demo CDN
// with no audio track at all — the Mute/Unmute controls toggled a track that
// never existed, and the four listed "chapters" couldn't possibly correspond
// to six seconds of footage, so it never showed anything resembling this app.
// This is a lightweight illustration built from real Studio copy instead.
const WAVEFORM_BARS = [18, 34, 52, 40, 66, 48, 72, 58, 44, 30, 62, 50, 36, 68, 46, 28];

const features = [
  { title: "Waveform Editing & Fades", icon: Scissors, desc: "Trim, split, and crossfade clips sample-accurately." },
  { title: "Mixer & Track Controls", icon: SlidersHorizontal, desc: "Volume, pan, sends, and a full FX chain per track." },
  { title: "AI Mastering", icon: Wand2, desc: "One click to polish loudness and clarity before you export." },
];

export default function StudioTutorial() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="mb-8 text-center md:text-left">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full mb-3 uppercase tracking-widest">
          <Sparkles className="w-3 h-3" />
          Studio Preview
        </div>
        <h2 className="font-heading font-black text-3xl sm:text-4xl md:text-5xl mb-3 text-gradient-animate drop-shadow-lg">
          Master the Studio
        </h2>
        <p className="text-foreground/70 text-lg font-medium max-w-2xl">
          A built-in DAW with waveform editing, a full mixer, and AI mastering — open it up and try it yourself.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Illustrated preview panel */}
        <div className="lg:col-span-2">
          <Link
            to="/studio"
            className="group relative flex flex-col justify-end rounded-2xl overflow-hidden border border-white/[0.06] bg-card/50 backdrop-blur-xl shadow-2xl aspect-video p-5 sm:p-6"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/15" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:2rem_2rem]" />

            {/* Mock track lanes with waveform bars, drawn from actual Studio colors */}
            <div className="relative z-10 flex flex-col gap-2 mb-4">
              {[
                { color: "bg-primary/70", offset: 0 },
                { color: "bg-accent/70", offset: 5 },
              ].map((lane, li) => (
                <div key={li} className="flex items-end gap-[3px] h-10 sm:h-12">
                  {WAVEFORM_BARS.map((h, i) => (
                    <div
                      key={i}
                      className={`w-1.5 rounded-full ${lane.color} group-hover:opacity-90 opacity-60 transition-opacity`}
                      style={{ height: `${WAVEFORM_BARS[(i + lane.offset) % WAVEFORM_BARS.length]}%` }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Mock mixer fader */}
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden shrink-0">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-accent" />
              </div>
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Mixer</span>
            </div>

            <button
              className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white/80 text-xs font-semibold group-hover:bg-primary/80 group-hover:text-white transition-colors"
              aria-label="Open the Studio"
            >
              <Play className="w-3.5 h-3.5" fill="currentColor" /> Open Studio
            </button>
          </Link>
        </div>

        {/* Feature list + CTA */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/[0.06] bg-card/50 backdrop-blur-xl p-5 flex-1">
            <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              What You Get
            </h3>
            <ul className="space-y-3">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.title} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{f.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <Link to="/studio" className="block">
            <Button className="w-full rounded-xl h-14 text-base font-bold bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary shimmer-hover">
              <Wand2 className="w-5 h-5 mr-2" />
              Try the Studio
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}