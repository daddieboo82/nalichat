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
  const isCollaborator = selectedProject?.collaborator_ids?.includes(currentUser?.id);
  const canEdit = isOwner || (isCollaborator && selectedProject?.collaborator_roles?.[currentUser?.id] === "editor");

  const { past, future, push, undo, redo } = useUndoRedo();

  const updateTrackMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Track.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks", selectedProjectId] });
    },
  });

  const deleteTrackMutation = useMutation({
    mutationFn: (id) => base44.entities.Track.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks", selectedProjectId] });
    },
  });

  const handleTrackUpdate = (trackId, data) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      push({ type: "track_update", trackId, before: track, after: { ...track, ...data } });
      updateTrackMutation.mutate({ id: trackId, data });
    }
  };

  const handleTrackDelete = (trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      push({ type: "track_delete", track });
      deleteTrackMutation.mutate(trackId);
    }
  };

  const handleUndo = () => {
    if (past.length === 0) return;
    const action = past[past.length - 1];
    if (action.type === "track_update") {
      updateTrackMutation.mutate({ id: action.trackId, data: action.before });
    } else if (action.type === "track_delete") {
      base44.entities.Track.create(action.track);
    }
    undo();
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const action = future[0];
    if (action.type === "track_update") {
      updateTrackMutation.mutate({ id: action.trackId, data: action.after });
    }
    redo();
  };

  if (!currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Project selector mode
  if (!selectedProjectId) {
    return (
      <ProjectSelector
        projects={projects}
        currentUser={currentUser}
        subscription={subscription}
        onSelectProject={setSelectedProjectId}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedProjectId(null)}
            className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
            title="Back to projects"
          >
            <ChevronLeft className="w-5 h-5 text-foreground/70" />
          </button>
          <div>
            <h1 className="font-heading font-bold text-lg text-foreground">{selectedProject?.title}</h1>
            <p className="text-xs text-muted-foreground">{tracks.length} tracks</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              disabled={past.length === 0}
              className="p-1.5 hover:bg-secondary rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Undo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              className="p-1.5 hover:bg-secondary rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Redo"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="px-4 py-2 border-b border-border flex gap-2 bg-secondary/20">
        {["arrange", "record", "mix"].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
              mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === "arrange" && (
          <StudioArrange
            tracks={tracks}
            project={selectedProject}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            canEdit={canEdit}
            currentUser={currentUser}
          />
        )}
        {mode === "record" && (
          <StudioRecorder
            projectId={selectedProjectId}
            currentUser={currentUser}
            onSave={async (file, name) => {
              const { file_url } = await base44.integrations.Core.UploadFile({ file });
              await base44.entities.Track.create({
                project_id: selectedProjectId,
                name: name || "Recording",
                file_url,
                type: "vocal",
                volume: 75,
                pan: 0,
                muted: false,
                solo: false,
                uploaded_by: currentUser.id,
                duration: 0,
              });
              queryClient.invalidateQueries({ queryKey: ["tracks", selectedProjectId] });
            }}
          />
        )}
        {mode === "mix" && (
          <StudioMixerPanel
            tracks={tracks}
            project={selectedProject}
            onTrackUpdate={handleTrackUpdate}
            onTrackDelete={handleTrackDelete}
            canEdit={canEdit}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
}