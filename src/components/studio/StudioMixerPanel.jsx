import { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, Sliders } from "lucide-react";
import MixerStrip from "./MixerStrip";

export default function StudioMixerPanel({
  tracks,
  project,
  isPlaying,
  canEdit,
}) {
  const [masterVolume, setMasterVolume] = useState(100);

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Sliders className="w-10 h-10 text-primary/60" />
          </div>
          <p className="text-muted-foreground text-sm">Add tracks to begin mixing</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Mixer Header */}
      <div className="bg-secondary/40 border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <h3 className="font-heading font-bold text-foreground">Mixer</h3>
        <p className="text-xs text-muted-foreground">{tracks.length} Track{tracks.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Mixer Strips */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-2 p-4 pb-6 min-w-min">
          {tracks.map((track, idx) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <MixerStrip track={track} />
            </motion.div>
          ))}

          {/* Master Channel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: tracks.length * 0.05 }}
            className="w-24 bg-secondary/50 border border-border/40 rounded-lg p-3 flex flex-col items-center justify-between min-h-96"
          >
            <div>
              <p className="text-xs font-bold text-foreground text-center mb-3">MASTER</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
                className="w-full h-32 [appearance:slider-vertical] [writing-mode:bt-lr] hover:opacity-80 transition-opacity"
                style={{
                  WebkitAppearance: "slider-vertical",
                  writingMode: "bt-lr",
                }}
              />
            </div>

            <div className="text-center mt-3">
              <p className="text-xs font-mono font-bold text-primary">{masterVolume}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">dB</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}