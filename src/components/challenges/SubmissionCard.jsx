import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Pause, Heart, Share2 } from "lucide-react";
import ShareButtons from "./ShareButtons";

export default function SubmissionCard({ submission, challengeId, hasVoted, isOwn, onVote, voteDisabled = false }) {
  const [playing, setPlaying] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  const shareUrl = `${window.location.origin}/challenge/${challengeId}/submission/${submission.id}`;

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <audio ref={audioRef} src={submission.remix_file_url} preload="none" onEnded={() => setPlaying(false)} />
      <div className="flex items-center gap-3">
        <Avatar className="w-9 h-9">
          <AvatarImage src={submission.producer_avatar} />
          <AvatarFallback>{submission.producer_name?.[0] || "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Link to={`/challenge/${challengeId}/submission/${submission.id}`} className="font-heading font-semibold text-sm truncate hover:text-primary block">
            {submission.remix_name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{submission.producer_name}</p>
        </div>
        <Button size="icon" variant="secondary" className="rounded-full shrink-0" onClick={togglePlay}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
      </div>

      {submission.description && <p className="text-xs text-muted-foreground line-clamp-2">{submission.description}</p>}

      <div className="flex items-center justify-between pt-1">
        <Button
          size="sm"
          variant={hasVoted ? "secondary" : "outline"}
          disabled={hasVoted || isOwn || voteDisabled}
          onClick={() => onVote(submission.id)}
          className="rounded-full gap-1.5"
        >
          <Heart className={`w-4 h-4 ${hasVoted ? "fill-primary text-primary" : ""}`} />
          {submission.vote_count || 0}
        </Button>
        <div className="relative">
          <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setShowShare(!showShare)}>
            <Share2 className="w-4 h-4" />
          </Button>
          {showShare && (
            <div className="absolute right-0 bottom-full mb-2 p-2 bg-popover border border-border rounded-xl shadow-xl z-10">
              <ShareButtons url={shareUrl} text={`Vote for "${submission.remix_name}" on NaliChat 🎧`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}