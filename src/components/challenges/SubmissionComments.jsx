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
    base44.entities.TrackComment.filter({ track_id: submissionId }, "-created_date", 50)
      .then(setComments)
      .finally(() => setLoading(false));
  }, [submissionId]);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    const created = await base44.entities.TrackComment.create({
      track_id: submissionId,
      author_id: user.id,
      author_name: user.full_name || user.email,
      author_avatar: user.avatar_url,
      text: text.trim(),
    });
    setComments([created, ...comments]);
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