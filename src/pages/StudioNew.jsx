import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUndoRedo } from "@/lib/useUndoRedo";

import StudioTransport from "@/components/studio/StudioTransport";
import StudioArrange from "@/components/studio/StudioArrange";
import StudioRecorder from "@/components/studio/StudioRecorder";
import StudioMixerPanel from "@/components/studio/StudioMixerPanel";
import ProjectSelector from "@/components/studio/ProjectSelector";

export default function StudioNew() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [mode, setMode] = useState("arrange"); // arrange | record | mix
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-updated_date"),
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const subs = await base44.entities.Subscription.filter({ user_id: currentUser?.id });
      return subs[0] || { plan: "free", status: "active" };
    },
    enabled: !!currentUser?.id,
  });

  const { data: tracks = [] } = useQuery({
    queryKey: ["tracks", selectedProjectId],
    queryFn: () => base44.entities.Track.filter({ project_id: selectedProjectId }),
    enabled: !!selectedProjectId,
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const isOwner = selectedProject?.owner_id === currentUser?.id;
  const myRole = selectedProject?.collaborator_roles?.[currentUser?.id] || "viewer";
  const canEdit = isOwner || myRole === "editor";

  if (!currentUser) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground font-heading">Loading studio...</p>
        </div>
      </div>
    );
  }

  if (!selectedProjectId) {
    return (
      <ProjectSelector
        projects={projects}
        subscription={subscription}
        currentUser={currentUser}
        onSelectProject={setSelectedProjectId}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-secondary/5 to-background" style={{ background: "hsl(240 10% 3%)" }}>
      {/* Top Bar - Enhanced */}
      <div className="h-16 border-b border-primary/10 flex items-center px-6 gap-4 bg-gradient-to-r from-secondary/40 via-secondary/20 to-background backdrop-blur-xl shadow-lg shadow-primary/5">
        <button
          onClick={() => setSelectedProjectId(null)}
          className="p-2 -ml-2 rounded-xl hover:bg-secondary/60 transition-all text-muted-foreground hover:text-primary active:scale-95"
          title="Back to projects"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-heading font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent truncate">
            {selectedProject?.title}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground/70 font-mono">{selectedProject?.bpm} BPM</span>
            <span className="text-xs text-muted-foreground/70">•</span>
            <span className="text-xs text-muted-foreground/70 font-mono">{selectedProject?.key}</span>
            <span className="text-xs text-muted-foreground/70">•</span>
            <span className="text-xs text-accent font-semibold">{tracks.length} Track{tracks.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Undo/Redo Buttons */}
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            disabled
            className="rounded-lg w-9 h-9 hover:bg-secondary/60 hover:text-primary transition-all text-muted-foreground"
            title="Undo"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled
            className="rounded-lg w-9 h-9 hover:bg-secondary/60 hover:text-primary transition-all text-muted-foreground"
            title="Redo"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Mode Selector - Enhanced */}
        <div className="flex gap-2 bg-secondary/30 rounded-xl p-1.5 border border-border/30 shadow-lg shadow-primary/5">
          {[
            { id: "record", label: "Record" },
            { id: "arrange", label: "Arrange" },
            { id: "mix", label: "Mix" },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                mode === m.id
                  ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {mode === "record" ? (
          <StudioRecorder
            project={selectedProject}
            currentUser={currentUser}
            canEdit={canEdit}
            onRecordingComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["tracks", selectedProjectId] });
            }}
          />
        ) : mode === "arrange" ? (
          <StudioArrange
            tracks={tracks}
            project={selectedProject}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            canEdit={canEdit}
            currentUser={currentUser}
          />
        ) : (
          <StudioMixerPanel
            tracks={tracks}
            project={selectedProject}
            isPlaying={isPlaying}
            canEdit={canEdit}
          />
        )}
      </div>

      {/* Transport Bar (always visible) */}
      <StudioTransport
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onStop={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        currentTime={currentTime}
        duration={duration}
        projectBpm={selectedProject?.bpm}
      />
    </div>
  );
}