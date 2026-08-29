import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Scissors, SlidersHorizontal, Layers, Wand2, ArrowRight, Clock } from "lucide-react";

const TUTORIAL_VIDEO = "https://media.base44.com/videos/public/6a1f5ee134147461560c2b37/7ec84bf34_Studio_Tutorial.mp4";

const chapters = [
  { time: "0:00", title: "Studio Overview", icon: Layers },
  { time: "0:01", title: "Waveform Editing & Fades", icon: Scissors },
  { time: "0:02", title: "Mixer & Track Controls", icon: SlidersHorizontal },
  { time: "0:03", title: "AI Mastering", icon: Wand2 },
];

export default function StudioTutorial() {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = (node) => {
    if (node) {
      if (playing) {
        node.play().catch(() => {});
      } else {
        node.pause();
      }
      node.muted = muted;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="mb-8 text-center md:text-left">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full mb-3 uppercase tracking-widest">
          <Play className="w-3 h-3" />
          Video Tutorial
        </div>
        <h2 className="font-heading font-black text-3xl sm:text-4xl md:text-5xl mb-3 text-gradient-animate drop-shadow-lg">
          Master the Studio
        </h2>
        <p className="text-foreground/70 text-lg font-medium max-w-2xl">
          Watch a quick walkthrough of the Studio's powerful features — from waveform editing to AI mastering.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          <div className="relative group rounded-2xl overflow-hidden border border-white/[0.06] bg-card/50 backdrop-blur-xl shadow-2xl">
            <video
              ref={videoRef}
              src={TUTORIAL_VIDEO}
              className="w-full aspect-video object-cover"
              loop
              playsInline
              muted={muted}
              onClick={() => setPlaying((p) => !p)}
            />
            {/* Center play/pause overlay */}
            {!playing && (
              <button
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors"
                aria-label="Play tutorial video"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/90 flex items-center justify-center shadow-2xl glow-primary group-hover:scale-110 transition-transform">
                  <Play className="w-7 h-7 sm:w-9 sm:h-9 text-white ml-1" fill="white" />
                </div>
              </button>
            )}
            {playing && (
              <button
                onClick={() => setPlaying(false)}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Pause tutorial video"
              >
                <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                  <Pause className="w-6 h-6 text-white" fill="white" />
                </div>
              </button>
            )}
            {/* Controls bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="text-white/90 hover:text-white transition-colors"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5" fill="white" />}
                </button>
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="text-white/90 hover:text-white transition-colors"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>
              <span className="text-xs text-white/70 font-medium flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Quick Tour
              </span>
            </div>
          </div>
        </div>

        {/* Chapter list + CTA */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/[0.06] bg-card/50 backdrop-blur-xl p-5 flex-1">
            <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              What You'll Learn
            </h3>
            <ul className="space-y-3">
              {chapters.map((ch) => {
                const Icon = ch.icon;
                return (
                  <li key={ch.title} className="flex items-center gap-3 group cursor-default">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ch.title}</p>
                      <p className="text-xs text-muted-foreground">{ch.time}</p>
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