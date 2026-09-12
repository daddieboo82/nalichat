import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Scissors, SlidersHorizontal, Wand2, ArrowRight, Sparkles, PlayCircle, Download } from "lucide-react";

const demos = [
  {
    title: "Build & Play",
    subtitle: "Real Studio session",
    description: "A live two-track NaliStudio session with the real timeline, waveforms, transport, markers, and playback controls.",
    src: "/studio-demos/session-playback.webm",
    icon: PlayCircle,
  },
  {
    title: "Mix & Shape",
    subtitle: "Mixer + FX",
    description: "The actual mixer in action — track levels, real VU metering, channel controls, sends, and FX workflow.",
    src: "/studio-demos/mixer-fx.webm",
    icon: SlidersHorizontal,
  },
  {
    title: "Finish & Export",
    subtitle: "Real export workflow",
    description: "The real NaliStudio export flow for turning a finished session into a mix users can take anywhere.",
    src: "/studio-demos/export-workflow.webm",
    icon: Download,
  },
];

const features = [
  { title: "Waveform Editing & Fades", icon: Scissors, desc: "Trim, split, and shape clips directly in the Studio timeline." },
  { title: "Mixer & Track Controls", icon: SlidersHorizontal, desc: "Volume, pan, sends, mute/solo, metering, and FX per track." },
  { title: "AI-Assisted Finishing", icon: Wand2, desc: "Move from recording to mastering, export, and publishing in one workflow." },
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
          Real Studio Experience
        </div>
        <h2 className="font-heading font-black text-3xl sm:text-4xl md:text-5xl mb-3 text-gradient-animate drop-shadow-lg">
          Master the Studio
        </h2>
        <p className="text-foreground/70 text-lg font-medium max-w-3xl">
          See the actual NaliStudio in action — real waveforms, real mixer controls, real playback, and the real export workflow.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {demos.map((demo, index) => {
          const Icon = demo.icon;
          return (
            <motion.article
              key={demo.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="overflow-hidden rounded-2xl border border-white/[0.08] bg-card/60 shadow-2xl shadow-black/20"
            >
              <div className="relative aspect-video overflow-hidden bg-black">
                <video
                  className="h-full w-full object-cover"
                  src={demo.src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={`${demo.title} NaliStudio real app demo`}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute left-3 bottom-3 inline-flex items-center gap-2 rounded-full bg-black/65 backdrop-blur px-3 py-1.5 text-[11px] font-bold text-white border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  REAL APP CAPTURE
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-bold mb-1">{demo.subtitle}</p>
                    <h3 className="font-heading font-bold text-lg leading-tight">{demo.title}</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {demo.description}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1fr_auto] gap-5 items-stretch">
        <div className="rounded-2xl border border-white/[0.06] bg-card/50 backdrop-blur-xl p-5">
          <div className="grid sm:grid-cols-3 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{feature.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">{feature.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button className="h-auto min-h-16 px-7 rounded-xl text-base font-bold bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary shimmer-hover" asChild>
          <Link to="/studio" className="flex items-center justify-center">
            <Wand2 className="w-5 h-5 mr-2" />
            Try the Real Studio
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
