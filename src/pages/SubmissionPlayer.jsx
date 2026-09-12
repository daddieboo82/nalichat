import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Pause, Heart, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import ShareButtons from "@/components/challenges/ShareButtons";
import SubmissionComments from "@/components/challenges/SubmissionComments";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

const MAX_CHALLENGE_SUBMISSIONS = 500;

export default function SubmissionPlayer() {
  const { challengeId, submissionId } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const { user } = useAuth();
  const [submission, setSubmission] = useState(null);
  const [allSubs, setAllSubs] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    base44.entities.ChallengeSubmission
      .filter(
        { challenge_id: challengeId, status: "approved" },
        "-vote_count",
        MAX_CHALLENGE_SUBMISSIONS,
      )
      .then(setAllSubs);
  }, [challengeId]);

  useEffect(() => {
    setPlaying(false);
    base44.entities.ChallengeSubmission.get(submissionId).then(setSubmission);
  }, [submissionId]);

  useEffect(() => {
    if (!user) { setHasVoted(false); return; }
    base44.entities.ChallengeVote
      .filter({ submission_id: submissionId, voter_id: user.id }, "-created_date", 1)
      .then((v) => setHasVoted(v.length > 0));
  }, [user, submissionId]);

  const handleVote = async () => {
    if (!user) { navigate("/login"); return; }
    try {
      const res = await base44.functions.invoke("castVote", { submission_id: submissionId });
      setSubmission((s) => ({ ...s, vote_count: res.data.vote_count }));
      setHasVoted(true);
      toast.success("Vote counted!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't cast vote");
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };

  if (!submission) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  const idx = allSubs.findIndex((s) => s.id === submissionId);
  const prev = idx > 0 ? allSubs[idx - 1] : null;
  const next = idx >= 0 && idx < allSubs.length - 1 ? allSubs[idx + 1] : null;
  const shareUrl = `${window.location.origin}/challenge/${challengeId}/submission/${submissionId}`;
  const isOwn = user && submission.producer_id === user.id;

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
      <Link to={`/challenge/${challengeId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to challenge
      </Link>

      <div className="rounded-3xl bg-card border border-border p-6 space-y-5 text-center">
        <audio ref={audioRef} src={submission.remix_file_url} preload="none" onEnded={() => setPlaying(false)} />
        <div className="w-32 h-32 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Button size="icon" variant="ghost" className="w-16 h-16 text-white hover:bg-white/10" onClick={togglePlay}>
            {playing ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10" />}
          </Button>
        </div>
        <h1 className="font-heading text-xl font-bold">{submission.remix_name}</h1>

        <Link to={`/profile?id=${submission.producer_id}`} className="flex items-center justify-center gap-2">
          <Avatar className="w-8 h-8"><AvatarImage src={submission.producer_avatar} /><AvatarFallback>{submission.producer_name?.[0] || "?"}</AvatarFallback></Avatar>
          <span className="text-sm font-medium">{submission.producer_name}</span>
        </Link>

        {submission.description && <p className="text-sm text-muted-foreground">{submission.description}</p>}

        <Button
          size="lg"
          disabled={hasVoted || isOwn}
          onClick={handleVote}
          className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-white text-base h-12 gap-2"
        >
          <Heart className={`w-5 h-5 ${hasVoted ? "fill-white" : ""}`} /> {hasVoted ? "Voted" : "Vote"} ({submission.vote_count || 0})
        </Button>

        <div className="flex justify-center">
          <ShareButtons url={shareUrl} text={`Vote for "${submission.remix_name}" on NaliChat 🎧`} />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" disabled={!prev} onClick={() => prev && navigate(`/challenge/${challengeId}/submission/${prev.id}`)} className="rounded-xl gap-1">
          <ChevronLeft className="w-4 h-4" /> Previous
        </Button>
        <Button variant="outline" disabled={!next} onClick={() => next && navigate(`/challenge/${challengeId}/submission/${next.id}`)} className="rounded-xl gap-1">
          Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4">
        <SubmissionComments submissionId={submissionId} user={user} />
      </div>
    </div>
  );
}
