import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SubmissionComments({ submissionId, user }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await base44.functions.invoke("trackComments", {
        action: "list",
        parentType: "challenge_submission",
        parentId: submissionId,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "list" ||
        res?.data?.viewerUserId !== (user?.id || null) ||
        res?.data?.parentType !== "challenge_submission" ||
        res?.data?.parentId !== submissionId ||
        !Array.isArray(res?.data?.comments)
      ) {
        throw new Error("Comment list response was invalid.");
      }
      setComments(res.data.comments);
    } catch {
      setComments([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke("trackComments", {
        action: "create",
        parentType: "challenge_submission",
        parentId: submissionId,
        text: text.trim(),
      });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "create" ||
        res?.data?.userId !== user?.id ||
        res?.data?.parentType !== "challenge_submission" ||
        res?.data?.parentId !== submissionId
      ) {
        throw new Error("Comment creation was not confirmed.");
      }
      const created = res?.data?.comment;
      if (!created?.id || created.track_id !== submissionId || created.parent_type !== "challenge_submission") {
        throw new Error("Comment creation was not confirmed.");
      }
      setComments((current) => [...current, created]);
      setText("");
    } catch (error) {
      toast.error(error?.message || "Couldn't post your comment. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-heading font-semibold text-sm">Comments</h3>
      {user && (
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Leave a comment..." className="rounded-xl" onKeyDown={(e) => e.key === "Enter" && handleSend()} />
          <Button size="icon" className="rounded-xl shrink-0" onClick={handleSend} disabled={sending || !text.trim()}>{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</Button>
        </div>
      )}
      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm" role="alert">
          <p className="text-destructive">Couldn't load comments.</p>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void loadComments()}>
            Retry
          </Button>
        </div>
      )}
      {!loading && !loadError && comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>}
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2">
            <Avatar className="w-7 h-7"><AvatarImage src={c.author_avatar} /><AvatarFallback>{c.author_name?.[0] || "?"}</AvatarFallback></Avatar>
            <div>
              <p className="text-xs font-semibold">{c.author_name}</p>
              <p className="text-sm text-muted-foreground">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}