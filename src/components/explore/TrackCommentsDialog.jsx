import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { notify } from "@/lib/notifications";

export default function TrackCommentsDialog({ post, currentUser, open, onOpenChange }) {
  const [text, setText] = useState("");
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["track-comments", post?.id],
    queryFn: () => base44.entities.TrackComment.filter({ track_id: post.id }, "-created_date", 100),
    enabled: !!post?.id && open,
  });

  const addComment = useMutation({
    mutationFn: async () => {
      await base44.entities.TrackComment.create({
        track_id: post.id,
        author_id: currentUser.id,
        author_name: currentUser.display_name || currentUser.full_name,
        author_avatar: currentUser.avatar_url,
        text: text.trim(),
      });
      await notify({
        recipientId: post.creator_id,
        actor: currentUser,
        type: "comment",
        message: `commented on your track "${post.title}"`,
        link: "/explore",
      });
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["track-comments", post.id] });
    },
  });

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            Comments · {post.title}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto space-y-3 -mx-1 px-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No comments yet. Be the first!</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarImage src={c.author_avatar} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{c.author_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="bg-secondary/50 rounded-xl px-3 py-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold truncate">{c.author_name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(c.created_date), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5 break-words">{c.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            className="bg-secondary/50 border-0 rounded-xl"
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) addComment.mutate(); }}
          />
          <Button
            size="icon"
            className="rounded-xl bg-primary hover:bg-primary/90 shrink-0"
            disabled={!text.trim() || addComment.isPending}
            onClick={() => addComment.mutate()}
          >
            {addComment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}