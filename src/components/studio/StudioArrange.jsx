import { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import TrackArrangeItem from "./TrackArrangeItem";
import TrackImporter from "./TrackImporter";

export default function StudioArrange({
  tracks,
  project,
  isPlaying,
  currentTime,
  duration,
  canEdit,
  currentUser,
}) {
  const [selectedTrackId, setSelectedTrackId] = useState(null);

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <Volume2 className="w-10 h-10 text-primary/60" />
          </div>
          <h3 className="text-xl font-heading font-bold text-foreground mb-2">No Tracks Yet</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Start by recording a track or importing audio files to begin arranging
          </p>

          {canEdit && (
            <div className="flex gap-3 justify-center">
              <TrackImporter
                projectId={project.id}
                currentUser={currentUser}
                onSuccess={() => {}}
              />
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Track Headers with Time Ruler */}
      <div className="bg-secondary/40 border-b border-border/40 px-4 py-2 flex gap-3 items-start">
        <div className="w-48 shrink-0">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Tracks</p>
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1 min-w-min">
            {Array.from({ length: Math.ceil((duration || 120) / 10) }).map((_, i) => (
              <div key={i} className="w-20 text-right pr-1 text-[10px] text-muted-foreground/50">
                {i * 10}s
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-2">
          {tracks.map(track => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setSelectedTrackId(track.id)}
            >
              <TrackArrangeItem
                track={track}
                isSelected={selectedTrackId === track.id}
                duration={duration || 120}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}