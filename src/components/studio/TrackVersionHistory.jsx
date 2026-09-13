import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { History, RotateCcw, Play, Pause, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

async function listAllTrackVersions(trackId) {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.TrackVersion.filter(
      { track_id: trackId },
      "-version_number",
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function TrackVersionHistory({ track, open, onOpenChange, onRevert, canEdit, currentUser }) {
  const [playingId, setPlayingId] = useState(null);
  const [audioEl, setAudioEl] = useState(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: versions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["track-versions", currentUser?.id, track?.id],
    queryFn: () => listAllTrackVersions(track.id),
    enabled: !!currentUser?.id && !!track?.id && open,
  });

  const deleteVersion = useMutation({
    mutationFn: async (id) => {
      const res = await base44.functions.invoke("deleteTrackVersion", { versionId: id });
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["track-versions", currentUser?.id, track?.id] });
      toast.success("Version deleted.");
    },
    onError: (error) => {
      toast.error(error?.message || "Couldn't delete this version. Please try again.");
    },
  });

  const handleSaveSnapshot = async () => {
    if (!track || saving) return;
    setSaving(true);
    try {
      const created = await base44.functions.invoke("createTrackVersion", {
        track_id: track.id,
        project_id: track.project_id,
        label: label.trim() || undefined,
        volume: track.volume,
        pan: track.pan,
        muted: track.muted,
        solo: track.solo,
      });
      if (created?.data?.error) throw new Error(created.data.error);
      setLabel("");
      await queryClient.invalidateQueries({ queryKey: ["track-versions", currentUser?.id, track?.id] });
      toast.success("Version saved.");
    } catch (error) {
      console.error("Track version save failed", error);
      toast.error(error?.message || "Couldn't save this version. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handlePlay = (version) => {
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
    if (playingId === version.id) {
      setPlayingId(null);
      setAudioEl(null);
      return;
    }
    const el = new Audio(version.file_url);
    el.onended = () => { setPlayingId(null); setAudioEl(null); };
    el.play()
      .then(() => {
        setAudioEl(el);
        setPlayingId(version.id);
      })
      .catch((error) => {
        console.error("Track version playback failed", error);
        setAudioEl(null);
        setPlayingId(null);
        toast.error("Couldn't preview this version. Please try again.");
      });
  };

  const handleRevert = (version) => {
    onRevert({
      file_url: version.file_url,
      volume: version.volume,
      pan: version.pan,
      muted: version.muted,
      solo: version.solo,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && audioEl) { audioEl.pause(); setAudioEl(null); setPlayingId(null); }
      onOpenChange(v);
    }}>
      <DialogContent className="bg-card border-border max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Version History — {track?.name}
          </DialogTitle>
        </DialogHeader>

        {canEdit && (
          <div className="flex gap-2 pb-3 border-b border-border">
            <Input
              placeholder="Label (optional)..."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="bg-secondary/50 border-0 rounded-xl text-sm h-9 flex-1"
            />
            <Button
              size="sm"
              className="rounded-xl bg-primary hover:bg-primary/90 shrink-0"
              onClick={handleSaveSnapshot}
              disabled={saving}
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Save
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8 text-sm">Loading versions...</div>
          ) : isError ? (
            <div className="text-center py-8" role="alert">
              <p className="text-sm font-semibold">Couldn't load version history</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No saved versions yet.{canEdit && " Click Save to snapshot the current state."}
            </div>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-2 bg-secondary/30 rounded-xl p-3 border border-border/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className="text-[9px] border-0 bg-primary/20 text-primary px-1.5">
                      v{v.version_number}
                    </Badge>
                    <span className="text-sm font-medium truncate">{v.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {v.saved_by_name} · {formatDistanceToNow(new Date(v.created_date), { addSuffix: true })}
                  </p>
                  <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>Vol {v.volume ?? 75}%</span>
                    <span>Pan {v.pan ?? 0}</span>
                    {v.muted && <span className="text-destructive">Muted</span>}
                    {v.solo && <span className="text-accent">Solo</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handlePlay(v)}
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                      playingId === v.id ? "bg-accent/20 text-accent" : "bg-secondary hover:bg-secondary/80"
                    )}
                    title="Preview"
                  >
                    {playingId === v.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </button>

                  {canEdit && (
                    <>
                      <button
                        onClick={() => handleRevert(v)}
                        className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
                        title="Revert to this version"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteVersion.mutate(v.id)}
                        className="w-7 h-7 rounded-lg hover:bg-destructive/20 hover:text-destructive text-muted-foreground flex items-center justify-center transition-colors"
                        title="Delete version"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}