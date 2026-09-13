import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2, MessageCircle, Clock, Play, Pause } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function formatTime(seconds) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TrackCommentsDialog({ post, currentUser, open, onOpenChange }) {
  const [text, setText] = useState("");
  const [currentTime, setCurrentTime] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["track-comments", post?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("trackComments", {
        action: "list",
        parentType: "art_post",
        parentId: post.id,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "list" ||
        res?.data?.viewerUserId !== (currentUser?.id || null) ||
        res?.data?.parentType !== "art_post" ||
        res?.data?.parentId !== post.id ||
        !Array.isArray(res?.data?.comments)
      ) throw new Error("Comment list response was invalid.");
      return res.data.comments;
    },
    enabled: !!post?.id && open,
  });

  // Stop audio when dialog closes
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(null);
    }
  }, [open]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Track comment playback failed:", error);
      setIsPlaying(false);
      toast.error("Couldn't play this track. Please try again.");
    }
  };

  const seekTo = async (seconds) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Track comment seek playback failed:", error);
      setIsPlaying(false);
      toast.error("Couldn't play from that timestamp. Please try again.");
    }
  };

  const captureTimestamp = () => {
    if (audioRef.current && duration > 0) {
      setCurrentTime(Math.floor(audioRef.current.currentTime));
    }
  };

  const clearTimestamp = () => setCurrentTime(null);

  const addComment = useMutation({
    mutationFn: async () => {
      // Notifying the track creator is handled server-side by the
      // notifyOnTrackComment automation — no client-side notify() call here,
      // since a client can't create a Notification for another user (RLS).
      const res = await base44.functions.invoke("trackComments", {
        action: "create",
        parentType: "art_post",
        parentId: post.id,
        text: text.trim(),
        timestamp: currentTime,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "create" ||
        res?.data?.userId !== currentUser?.id ||
        res?.data?.parentType !== "art_post" ||
        res?.data?.parentId !== post.id
      ) {
        throw new Error("Comment creation was not confirmed.");
      }
      const created = res?.data?.comment;
      if (!created?.id || created.track_id !== post.id || created.parent_type !== "art_post") {
        throw new Error("Comment creation was not confirmed.");
      }
      return created;
    },
    onSuccess: () => {
      setText("");
      setCurrentTime(null);
      queryClient.invalidateQueries({ queryKey: ["track-comments", post.id] });
    },
    onError: () => {
      toast.error("Couldn't post your comment. Please try again.");
    },
  });

  const handleSend = () => {
    if (!text.trim()) return;
    if (!currentUser) {
      toast.error("Please sign in to comment");
      return;
    }
    addComment.mutate();
  };

  if (!post) return null;

  const timestampedComments = comments.filter(c => c.timestamp != null).sort((a, b) => a.timestamp - b.timestamp);
  const generalComments = comments.filter(c => c.timestamp == null);
  const sortedComments = [...timestampedComments, ...generalComments];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            Comments · {post.title}
          </DialogTitle>
        </DialogHeader>

        {/* Audio Player */}
        {post.file_url && (
          <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
            <audio
              ref={audioRef}
              src={post.file_url}
              onTimeUpdate={() => {}}
              onLoadedMetadata={(e) => setDuration(e.target.duration)}
              onEnded={() => setIsPlaying(false)}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={1}
                defaultValue={0}
                className="flex-1 h-1.5 accent-primary cursor-pointer"
                onChange={(e) => seekTo(Number(e.target.value))}
              />
              <span className="text-xs text-muted-foreground shrink-0">{formatTime(duration)}</span>
            </div>
            <button
              onClick={captureTimestamp}
              className="text-xs flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors"
              title="Pin comment to current playhead position"
            >
              <Clock className="w-3 h-3" />
              Pin comment to current time
            </button>
          </div>
        )}

        {/* Comments List */}
        <div className="max-h-64 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] space-y-3 -mx-1 px-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : isError ? (
            <div className="py-8 text-center" role="alert">
              <p className="text-sm font-semibold">Couldn't load comments</p>
              <p className="mt-1 text-xs text-muted-foreground">Try again before assuming this track has no comments.</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : sortedComments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No comments yet. Be the first!</p>
          ) : (
            sortedComments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarImage src={c.author_avatar} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{c.author_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="bg-secondary/50 rounded-xl px-3 py-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold truncate">{c.author_name}</span>
                    {c.timestamp != null && (
                      <button
                        onClick={() => seekTo(c.timestamp)}
                        className="flex items-center gap-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full hover:bg-primary/25 transition-colors font-mono"
                        title="Jump to this timestamp"
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(c.timestamp)}
                      </button>
                    )}
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">
                      {formatDistanceToNow(new Date(c.created_date), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5 break-words">{c.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="space-y-2 pt-2">
          {currentTime != null && (
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-lg px-3 py-1.5">
              <Clock className="w-3 h-3" />
              <span>Pinned at <span className="font-mono font-bold">{formatTime(currentTime)}</span></span>
              <button onClick={clearTimestamp} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={currentUser ? (currentTime != null ? `Comment at ${formatTime(currentTime)}...` : "Add a comment...") : "Sign in to comment..."}
              className="bg-secondary/50 border-0 rounded-xl"
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            />
            <Button
              size="icon"
              className="rounded-xl bg-primary hover:bg-primary/90 shrink-0"
              disabled={!text.trim() || addComment.isPending}
              onClick={handleSend}
            >
              {addComment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}