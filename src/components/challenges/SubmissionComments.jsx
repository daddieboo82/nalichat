import { useState, useEffect } from "react";
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    base44.functions.invoke("trackComments", {
      action: "list",
      parentType: "challenge_submission",
      parentId: submissionId,
    })
      .then((res) => {
        if (cancelled) return;
        if (res?.data?.error) throw new Error(res.data.error);
        setComments(res?.data?.comments || []);
      })
      .catch(() => {
        if (!cancelled) {
          setComments([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

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
      const created = res?.data?.comment;
      if (created) setComments((current) => [...current, created]);
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
      {loadError && <p className="text-sm text-destructive">Couldn\'t load comments. Reopen this submission to retry.</p>}
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