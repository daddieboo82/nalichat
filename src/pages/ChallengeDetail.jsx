import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Trophy, ListOrdered } from "lucide-react";
import CountdownTimer from "@/components/challenges/CountdownTimer";
import SubmissionCard from "@/components/challenges/SubmissionCard";
import SubmitRemixModal from "@/components/challenges/SubmitRemixModal";
import { toast } from "sonner";

export default function ChallengeDetail() {
  const { challengeId } = useParams();
  const [challenge, setChallenge] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [user, setUser] = useState(null);
  const [myVotes, setMyVotes] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSubmissions = () => base44.entities.ChallengeSubmission.filter({ challenge_id: challengeId, status: "approved" }, "-vote_count").then(setSubmissions);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Challenge.get(challengeId).then((c) => { setChallenge(c); setLoading(false); });
    loadSubmissions();
  }, [challengeId]);

  useEffect(() => {
    if (!user) { setMyVotes(new Set()); return; }
    base44.entities.ChallengeVote.filter({ challenge_id: challengeId, voter_id: user.id }).then((votes) => {
      setMyVotes(new Set(votes.map((v) => v.submission_id)));
    });
  }, [user, challengeId]);

  const handleVote = async (submissionId) => {
    if (!user) { toast.error("Log in to vote."); return; }
    try {
      const res = await base44.functions.invoke("castVote", { submission_id: submissionId });
      setSubmissions((subs) => subs.map((s) => (s.id === submissionId ? { ...s, vote_count: res.data.vote_count } : s)));
      setMyVotes((prev) => new Set(prev).add(submissionId));
      toast.success("Vote counted!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't cast vote");
    }
  };

  if (loading || !challenge) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  const canSubmit = challenge.status === "active";

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="rounded-3xl overflow-hidden border border-border bg-card">
        <div className="relative aspect-[16/6] bg-secondary">
          {challenge.cover_url && <img src={challenge.cover_url} alt={challenge.title} className="w-full h-full object-cover" />}
        </div>
        <div className="p-4 sm:p-6 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-heading text-2xl font-bold">{challenge.title}</h1>
              <p className="text-sm text-muted-foreground">Hosted by {challenge.host_artist_name}</p>
            </div>
            <Link to={`/challenge/${challengeId}/leaderboard`}>
              <Button variant="outline" size="sm" className="rounded-full gap-1.5"><ListOrdered className="w-4 h-4" /> Leaderboard</Button>
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {challenge.genre && <Badge variant="secondary">{challenge.genre}</Badge>}
            {challenge.bpm && <Badge variant="secondary">{challenge.bpm} BPM</Badge>}
            {challenge.key && <Badge variant="secondary">Key: {challenge.key}</Badge>}
          </div>

          {challenge.description && <p className="text-sm text-muted-foreground">{challenge.description}</p>}

          {challenge.prize_description && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-sm">
              <Trophy className="w-4 h-4 text-yellow-500 shrink-0" /> {challenge.prize_description}
            </div>
          )}

          {challenge.submission_end_date && challenge.status === "active" && (
            <CountdownTimer targetDate={challenge.submission_end_date} label="Submissions close in" />
          )}
        </div>
      </div>

      {challenge.stem_file_urls?.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-2">
          <h2 className="font-heading font-bold">Original Stems</h2>
          {challenge.stem_file_urls.map((url, i) => (
            <div key={url} className="flex items-center gap-3 p-2 rounded-xl bg-secondary/40">
              <audio controls src={url} className="flex-1 h-9" />
              <a href={url} download title="Download stem">
                <Button size="icon" variant="ghost"><Download className="w-4 h-4" /></Button>
              </a>
              <span className="text-xs text-muted-foreground shrink-0 max-w-[100px] truncate">{challenge.stem_names?.[i] || `Stem ${i + 1}`}</span>
            </div>
          ))}
        </div>
      )}

      {challenge.rules && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <h2 className="font-heading font-bold mb-1">Rules</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{challenge.rules}</p>
        </div>
      )}

      {canSubmit && (
        <Button onClick={() => user ? setModalOpen(true) : toast.error("Log in to submit a remix.")} className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-white h-12 text-base">
          Submit Your Remix
        </Button>
      )}

      <div className="space-y-3">
        <h2 className="font-heading font-bold text-lg">Submissions ({submissions.length})</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {submissions.map((s) => (
            <SubmissionCard
              key={s.id}
              submission={s}
              challengeId={challengeId}
              hasVoted={myVotes.has(s.id)}
              isOwn={user && s.producer_id === user.id}
              onVote={handleVote}
            />
          ))}
        </div>
        {submissions.length === 0 && <p className="text-center text-muted-foreground py-8">No submissions yet — be the first!</p>}
      </div>

      {user && (
        <SubmitRemixModal open={modalOpen} onOpenChange={setModalOpen} challenge={challenge} user={user} onSubmitted={loadSubmissions} />
      )}
    </div>
  );
}