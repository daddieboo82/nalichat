import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Pause, Heart, Share2 } from "lucide-react";
import ShareButtons from "./ShareButtons";
import { toast } from "sonner";

export default function SubmissionCard({ submission, challengeId, hasVoted, isOwn, onVote, voteDisabled = false }) {
  const [playing, setPlaying] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch (error) {
      console.error("Submission playback failed:", error);
      setPlaying(false);
      toast.error("Couldn't play this remix. Please try again.");
    }
  };

  const shareUrl = `${window.location.origin}/challenge/${challengeId}/submission/${submission.id}`;

  return (
    <div className="ui-surface space-y-3 rounded-2xl border border-border bg-card p-4">
      <audio ref={audioRef} src={submission.remix_file_url} preload="none" onEnded={() => setPlaying(false)} />
      <div className="flex items-center gap-3">
        <Avatar className="w-9 h-9">
          <AvatarImage src={submission.producer_avatar} />
          <AvatarFallback>{submission.producer_name?.[0] || "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Link to={`/challenge/${challengeId}/submission/${submission.id}`} className="ui-hover block min-h-9 truncate rounded-lg py-2 font-heading text-sm font-semibold hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40">
            {submission.remix_name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{submission.producer_name}</p>
        </div>
        <Button size="icon" variant="secondary" className="ui-hover h-11 w-11 shrink-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40" onClick={togglePlay} aria-label={playing ? "Pause remix" : "Play remix"}>
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
          className="ui-hover min-h-10 rounded-xl gap-1.5"
        >
          <Heart className={`w-4 h-4 ${hasVoted ? "fill-primary text-primary" : ""}`} />
          {submission.vote_count || 0}
        </Button>
        <div className="relative">
          <Button size="icon" variant="ghost" className="ui-hover h-10 w-10 rounded-xl" onClick={() => setShowShare(!showShare)} aria-label="Share remix">
            <Share2 className="w-4 h-4" />
          </Button>
          {showShare && (
            <div className="absolute bottom-full right-0 z-10 mb-2 rounded-2xl border border-border bg-popover p-2 shadow-xl">
              <ShareButtons url={shareUrl} text={`Vote for "${submission.remix_name}" on NaliBase 🎧`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}