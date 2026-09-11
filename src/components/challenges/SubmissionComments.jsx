import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";

export default function SubmissionComments({ submissionId, user }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke("trackComments", {
      action: "list",
      parentType: "challenge_submission",
      parentId: submissionId,
    })
      .then((res) => setComments(res?.data?.comments || []))
      .finally(() => setLoading(false));
  }, [submissionId]);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    const res = await base44.functions.invoke("trackComments", {
      action: "create",
      parentType: "challenge_submission",
      parentId: submissionId,
      text: text.trim(),
    });
    if (res?.data?.error) throw new Error(res.data.error);
    const created = res?.data?.comment;
    setComments(created ? [created, ...comments] : comments);
    setText("");
  };

  return (
    <div className="space-y-3">
      <h3 className="font-heading font-semibold text-sm">Comments</h3>
      {user && (
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Leave a comment..." className="rounded-xl" onKeyDown={(e) => e.key === "Enter" && handleSend()} />
          <Button size="icon" className="rounded-xl shrink-0" onClick={handleSend}><Send className="w-4 h-4" /></Button>
        </div>
      )}
      {!loading && comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>}
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