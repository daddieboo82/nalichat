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

async function listAllApprovedSubmissions(challengeId) {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.ChallengeSubmission.filter(
      { challenge_id: challengeId, status: "approved" },
      "-vote_count",
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function SubmissionPlayer() {
  const { challengeId, submissionId } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const { user, navigateToLogin } = useAuth();
  const [submission, setSubmission] = useState(null);
  const [allSubs, setAllSubs] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [submissionLoading, setSubmissionLoading] = useState(true);
  const [submissionError, setSubmissionError] = useState(false);
  const [listError, setListError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setListError(false);
    listAllApprovedSubmissions(challengeId)
      .then((nextSubmissions) => {
        if (!cancelled) setAllSubs(nextSubmissions || []);
      })
      .catch(() => {
        if (!cancelled) {
          setAllSubs([]);
          setListError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [challengeId, retryKey]);

  useEffect(() => {
    let cancelled = false;
    setPlaying(false);
    setSubmission(null);
    setSubmissionLoading(true);
    setSubmissionError(false);
    base44.entities.ChallengeSubmission.get(submissionId)
      .then((nextSubmission) => {
        if (!cancelled) {
          setSubmission(nextSubmission);
          setSubmissionError(!nextSubmission);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubmission(null);
          setSubmissionError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setSubmissionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId, retryKey]);

  useEffect(() => {
    if (!user) { setHasVoted(false); return undefined; }
    let cancelled = false;
    base44.entities.ChallengeVote
      .filter({ submission_id: submissionId, voter_id: user.id }, "-created_date", 1)
      .then((votes) => {
        if (!cancelled) setHasVoted((votes || []).length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasVoted(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, submissionId]);

  const handleVote = async () => {
    if (!user) { navigateToLogin(); return; }
    try {
      const res = await base44.functions.invoke("castVote", { submission_id: submissionId });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "vote" ||
        res?.data?.userId !== user.id ||
        res?.data?.submissionId !== submissionId ||
        res?.data?.challengeId !== challengeId
      ) {
        throw new Error("Vote response was invalid");
      }
      const nextVoteCount = Number(res?.data?.vote_count);
      if (!Number.isFinite(nextVoteCount)) throw new Error("Vote response was invalid");
      setSubmission((s) => s ? ({ ...s, vote_count: nextVoteCount }) : s);
      setHasVoted(true);
      toast.success("Vote counted!");
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Couldn't cast vote");
    }
  };

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

  if (submissionLoading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (submissionError || !submission) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <h1 className="font-heading text-xl font-bold">Submission unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">This remix couldn't be loaded. It may have been removed or the connection may have failed.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => setRetryKey((key) => key + 1)}>Retry</Button>
          <Button variant="ghost" onClick={() => navigate(`/challenge/${challengeId}`)}>Back to Challenge</Button>
        </div>
      </div>
    );
  }

  const idx = allSubs.findIndex((s) => s.id === submissionId);
  const prev = idx > 0 ? allSubs[idx - 1] : null;
  const next = idx >= 0 && idx < allSubs.length - 1 ? allSubs[idx + 1] : null;
  const shareUrl = `${window.location.origin}/challenge/${challengeId}/submission/${submissionId}`;
  const isOwn = user && submission.producer_id === user.id;

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-5 pb-[max(6rem,env(safe-area-inset-bottom))] sm:p-6 sm:space-y-6">
      <Link to={`/challenge/${challengeId}`} className="ui-hover inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40">
        <ArrowLeft className="w-4 h-4" /> Back to challenge
      </Link>

      <div className="ui-surface space-y-5 rounded-3xl border border-border bg-card p-5 text-center sm:p-6">
        <audio ref={audioRef} src={submission.remix_file_url} preload="none" onEnded={() => setPlaying(false)} />
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent shadow-xl shadow-primary/15 sm:h-32 sm:w-32">
          <Button size="icon" variant="ghost" className="ui-hover h-16 w-16 rounded-2xl text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70" onClick={togglePlay}>
            {playing ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10" />}
          </Button>
        </div>
        <h1 className="font-heading text-xl font-bold">{submission.remix_name}</h1>

        <Link to={`/profile?id=${submission.producer_id}`} className="ui-hover mx-auto flex min-h-10 w-fit items-center justify-center gap-2 rounded-xl px-2 hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-primary/40">
          <Avatar className="w-8 h-8"><AvatarImage src={submission.producer_avatar} /><AvatarFallback>{submission.producer_name?.[0] || "?"}</AvatarFallback></Avatar>
          <span className="text-sm font-medium">{submission.producer_name}</span>
        </Link>

        {submission.description && <p className="text-sm text-muted-foreground">{submission.description}</p>}

        <Button
          size="lg"
          disabled={hasVoted || isOwn}
          onClick={handleVote}
          className="ui-hover h-12 w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-base font-semibold text-white shadow-lg shadow-primary/10"
        >
          <Heart className={`w-5 h-5 ${hasVoted ? "fill-white" : ""}`} /> {hasVoted ? "Voted" : "Vote"} ({submission.vote_count || 0})
        </Button>

        <div className="flex justify-center">
          <ShareButtons url={shareUrl} text={`Vote for "${submission.remix_name}" on NaliChat 🎧`} />
        </div>
      </div>

      {listError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center text-sm" role="alert">
          Couldn't load the challenge submission list, so Previous/Next navigation may be unavailable.
          <button type="button" className="ui-hover ml-1 min-h-9 rounded-lg px-2 font-semibold text-primary hover:bg-primary/10" onClick={() => setRetryKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-between">
        <Button variant="outline" disabled={!prev} onClick={() => prev && navigate(`/challenge/${challengeId}/submission/${prev.id}`)} className="ui-hover min-h-11 rounded-xl gap-1">
          <ChevronLeft className="w-4 h-4" /> Previous
        </Button>
        <Button variant="outline" disabled={!next} onClick={() => next && navigate(`/challenge/${challengeId}/submission/${next.id}`)} className="ui-hover min-h-11 rounded-xl gap-1">
          Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="ui-surface rounded-2xl border border-border bg-card p-4">
        <SubmissionComments submissionId={submissionId} user={user} />
      </div>
    </div>
  );
}
