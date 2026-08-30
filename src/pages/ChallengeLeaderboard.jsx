import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All Time" },
  { key: "week", label: "This Week" },
  { key: "today", label: "Today" },
];

export default function ChallengeLeaderboard() {
  const { challengeId } = useParams();
  const [challenge, setChallenge] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [votes, setVotes] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    base44.entities.Challenge.get(challengeId).then(setChallenge);
    base44.entities.ChallengeSubmission.filter({ challenge_id: challengeId, status: "approved" }).then(setSubmissions);
    base44.entities.ChallengeVote.filter({ challenge_id: challengeId }).then(setVotes).catch(() => setVotes([]));
  }, [challengeId]);

  const ranked = useMemo(() => {
    if (filter === "all") {
      return [...submissions].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
    }
    const cutoff = new Date();
    if (filter === "week") cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setHours(0, 0, 0, 0);
    const counts = {};
    votes.forEach((v) => {
      if (new Date(v.created_date) >= cutoff) counts[v.submission_id] = (counts[v.submission_id] || 0) + 1;
    });
    return [...submissions].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).map((s) => ({ ...s, _count: counts[s.id] || 0 }));
  }, [submissions, votes, filter]);

  const getCount = (s) => (filter === "all" ? s.vote_count || 0 : s._count || 0);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Leaderboard</h1>
        {challenge && <p className="text-muted-foreground text-sm">{challenge.title}</p>}
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn("px-3 py-1.5 rounded-full text-sm font-medium border", filter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {ranked.map((s, i) => (
          <Link
            key={s.id}
            to={`/challenge/${challengeId}/submission/${s.id}`}
            className={cn(
              "flex items-center gap-3 p-3 rounded-2xl border transition-colors",
              i === 0 ? "bg-yellow-500/10 border-yellow-500/40" : i === 1 ? "bg-slate-400/10 border-slate-400/30" : i === 2 ? "bg-orange-500/10 border-orange-500/30" : "bg-card border-border"
            )}
          >
            <div className="w-8 text-center font-heading font-bold text-lg shrink-0">
              {i < 3 ? <Trophy className={cn("w-5 h-5 mx-auto", i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : "text-orange-500")} /> : `#${i + 1}`}
            </div>
            <Avatar className="w-9 h-9 shrink-0"><AvatarImage src={s.producer_avatar} /><AvatarFallback>{s.producer_name?.[0] || "?"}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{s.remix_name}</p>
              <p className="text-xs text-muted-foreground truncate">{s.producer_name}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-sm font-bold">
              <Play className="w-4 h-4 text-primary" /> {getCount(s)}
            </div>
          </Link>
        ))}
        {ranked.length === 0 && <p className="text-center text-muted-foreground py-12">No submissions yet.</p>}
      </div>
    </div>
  );
}