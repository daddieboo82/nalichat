import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX, Trash2, Settings2, Layers, History, MessageSquare, Send } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import TrackVersionHistory from "./TrackVersionHistory";

const trackTypeColors = {
  vocal: "bg-primary",
  instrument: "bg-accent",
  beat: "bg-chart-4",
  sample: "bg-chart-3",
  fx: "bg-chart-5",
  master: "bg-foreground",
};

export default function TrackStrip({ track, onUpdate, onDelete, audioRef: externalRef, isPlaying, duration, masterVolume, inQueue, onToggleQueue, canEdit = true, currentUser, isSoloedAway }) {
  const [showPan, setShowPan] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [activeCommentTime, setActiveCommentTime] = useState(null);
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ["trackComments", currentUser?.id, track.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("trackComments", {
        action: "list",
        parentType: "track",
        parentId: track.id,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data?.comments || [];
    },
    enabled: !!currentUser?.id && !!track?.id,
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ text, timestamp }) => {
      const res = await base44.functions.invoke("trackComments", {
        action: "create",
        parentType: "track",
        parentId: track.id,
        text,
        timestamp,
      });
      if (res?.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trackComments", currentUser?.id, track.id] });
      setCommentText("");
      setActiveCommentTime(null);
    }
  });
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  // Stable waveform bar heights — regenerated only when track id changes
  const waveformBars = useMemo(() => Array.from({ length: 60 }, () => Math.random() * 28 + 4), [track.id]);
  // externalRef may be a callback ref (function) or a ref object; normalise to an object
  const audioRef = useRef(null);
  const setAudioRef = useCallback((el) => {
    audioRef.current = el;
    if (typeof externalRef === "function") externalRef(el);
    else if (externalRef) externalRef.current = el;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = ((track.volume || 75) / 100) * ((masterVolume ?? 100) / 100);
    }
  }, [masterVolume, track.volume]);

  // Mute and Solo are mutually exclusive — enabling one clears the other.
  const toggleMute = () => canEdit && onUpdate({ muted: !track.muted, ...(!track.muted ? { solo: false } : {}) });
  const toggleSolo = () => canEdit && onUpdate({ solo: !track.solo, ...(!track.solo ? { muted: false } : {}) });

  return (
    <div className={cn(
      "bg-secondary/30 rounded-xl border border-border p-3 transition-all",
      track.muted && "opacity-40",
      track.solo && "border-accent ring-1 ring-accent/20"
    )}>
      {track.file_url && (
        <audio
          ref={setAudioRef}
          src={track.file_url}
          onTimeUpdate={() => {}}
        />
      )}

      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", (track.muted || isSoloedAway) ? "bg-muted-foreground/50" : (trackTypeColors[track.type] || "bg-muted"))} />
        <span className="font-medium text-xs flex-1 truncate" title={track.name}>{track.name}</span>
        <span className="text-[9px] text-muted-foreground uppercase">{track.type}</span>
      </div>

      {/* Waveform */}
      <div 
        className="h-10 bg-secondary rounded-lg mb-2 flex items-center gap-px px-1.5 overflow-hidden relative group cursor-crosshair"
        onClick={(e) => {
          if (!duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const percentage = clickX / rect.width;
          setActiveCommentTime(percentage * duration);
        }}
      >
        {waveformBars.map((h, i) => (
          <div
            key={i}
            className={cn("flex-1 rounded-full", track.muted ? "bg-muted-foreground/20" : trackTypeColors[track.type] || "bg-primary")}
            style={{ height: `${h}px`, opacity: track.muted ? 0.3 : 0.7 }}
          />
        ))}

        {/* Existing Comments Markers */}
        {comments.map(comment => (
          <Popover key={comment.id}>
            <PopoverTrigger asChild>
              <button 
                className="absolute w-5 h-5 -ml-2.5 rounded-full bg-white border-2 border-primary shadow flex items-center justify-center hover:scale-125 transition-transform z-10"
                style={{ left: `${(comment.timestamp / duration) * 100}%` }}
                onClick={(e) => e.stopPropagation()}
              >
                <Avatar className="w-full h-full">
                  <AvatarImage src={comment.author_avatar} />
                  <AvatarFallback className="text-[8px] bg-primary/20 text-primary font-bold">{comment.author_name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={comment.author_avatar} />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold">{comment.author_name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold truncate pr-2">{comment.author_name || "Unknown"}</p>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {Math.floor(comment.timestamp / 60)}:{String(Math.floor(comment.timestamp % 60)).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 break-words leading-relaxed">{comment.text}</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ))}

        {/* New Comment Popover */}
        {activeCommentTime !== null && (
          <Popover open={true} onOpenChange={(open) => !open && setActiveCommentTime(null)}>
            <PopoverTrigger asChild>
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                style={{ left: `${(activeCommentTime / duration) * 100}%` }}
              >
                <div className="absolute -top-1 -ml-1.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                  <MessageSquare className="w-2 h-2 text-white" />
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" onClick={e => e.stopPropagation()} onPointerDownOutside={() => setActiveCommentTime(null)}>
              <div className="flex gap-2">
                <Input 
                  size="sm" 
                  autoFocus
                  placeholder="Add comment at this time..." 
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && commentText.trim()) {
                      addCommentMutation.mutate({ text: commentText.trim(), timestamp: activeCommentTime });
                    }
                  }}
                  className="h-8 text-xs"
                />
                <Button 
                  size="icon" 
                  className="h-8 w-8 shrink-0"
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  onClick={() => addCommentMutation.mutate({ text: commentText.trim(), timestamp: activeCommentTime })}
                >
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <button
                    onClick={toggleMute}
                    className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-[11px]",
                      track.muted ? "bg-destructive/20 text-destructive" : "bg-secondary hover:bg-secondary/80"
                    )}
                  >
                    {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Mute</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <button
                    onClick={toggleSolo}
                    className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-[11px] font-bold",
                      track.solo ? "bg-accent/20 text-accent" : "bg-secondary hover:bg-secondary/80"
                    )}
                  >
                    S
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Solo</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex-1">
            <Slider
              value={[track.volume || 75]}
              max={100}
              step={1}
              onValueChange={([v]) => canEdit && onUpdate({ volume: v })}
              className="w-full"
              disabled={!canEdit}
            />
          </div>
          <span className="text-[9px] text-muted-foreground w-6 text-right">{track.volume || 75}%</span>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <button
                    onClick={() => setShowPan(!showPan)}
                    className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                      showPan ? "bg-primary/20 text-primary" : "bg-secondary hover:bg-secondary/80"
                    )}
                  >
                    <Settings2 className="w-3 h-3" />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Pan</TooltipContent>
            </Tooltip>

            {onToggleQueue && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <button
                      onClick={onToggleQueue}
                      className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                        inQueue ? "bg-primary/20 text-primary" : "bg-secondary hover:bg-secondary/80"
                      )}
                    >
                      <Layers className="w-3 h-3" />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">{inQueue ? "Remove from queue" : "Add to queue"}</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <button
                    onClick={() => setShowVersionHistory(true)}
                    className="w-7 h-7 rounded-lg bg-secondary hover:bg-primary/20 hover:text-primary flex items-center justify-center transition-colors"
                  >
                    <History className="w-3 h-3" />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Version history</TooltipContent>
            </Tooltip>

            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <button
                      onClick={onDelete}
                      className="w-7 h-7 rounded-lg bg-secondary hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Delete</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>

        {/* Pan Control */}
        {showPan && (
          <div className="px-1.5 py-1.5 bg-secondary/50 rounded-lg border border-border/50">
            <div className="text-[9px] text-muted-foreground mb-1">Pan: {track.pan || 0}</div>
            <Slider
              value={[track.pan || 0]}
              min={-100}
              max={100}
              step={1}
              onValueChange={([v]) => canEdit && onUpdate({ pan: v })}
              className="w-full"
              disabled={!canEdit}
            />
          </div>
        )}
      </div>

      <TrackVersionHistory
        track={track}
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        onRevert={(data) => onUpdate(data)}
        canEdit={canEdit}
        currentUser={currentUser}
      />
    </div>
  );
}