import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_LEADERBOARD_SUBMISSIONS = 500;

const FILTERS = [
  { key: "all", label: "All Time" },
  { key: "week", label: "This Week" },
  { key: "today", label: "Today" },
];

export default function ChallengeLeaderboard() {
  const { challengeId } = useParams();
  const [challenge, setChallenge] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [voteCounts, setVoteCounts] = useState({});
  const [truncated, setTruncated] = useState({ submissions: false, weeklyVotes: false });
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    base44.entities.Challenge.get(challengeId)
      .then((nextChallenge) => {
        if (!cancelled) setChallenge(nextChallenge);
      })
      .catch(() => {
        if (!cancelled) setChallenge(null);
      });

    base44.entities.ChallengeSubmission
      .filter(
        { challenge_id: challengeId, status: "approved" },
        "-vote_count",
        MAX_LEADERBOARD_SUBMISSIONS,
      )
      .then((nextSubmissions) => {
        if (!cancelled) setSubmissions(nextSubmissions || []);
      })
      .catch(() => {
        if (!cancelled) setSubmissions([]);
      });

    base44.functions.invoke("getChallengeLeaderboard", { challengeId })
      .then((res) => {
        if (cancelled) return;
        setVoteCounts(res?.data?.counts || {});
        setTruncated(res?.data?.truncated || { submissions: false, weeklyVotes: false });
      })
      .catch(() => {
        if (cancelled) return;
        setVoteCounts({});
        setTruncated({ submissions: false, weeklyVotes: false });
      });

    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  const ranked = useMemo(() => {
    const key = filter === "today" ? "today" : filter === "week" ? "week" : "all";
    return [...submissions].sort((a, b) => {
      const aCount = voteCounts[a.id]?.[key] ?? (key === "all" ? a.vote_count || 0 : 0);
      const bCount = voteCounts[b.id]?.[key] ?? (key === "all" ? b.vote_count || 0 : 0);
      return bCount - aCount;
    });
  }, [submissions, voteCounts, filter]);

  const getCount = (s) => {
    const key = filter === "today" ? "today" : filter === "week" ? "week" : "all";
    return voteCounts[s.id]?.[key] ?? (key === "all" ? s.vote_count || 0 : 0);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Leaderboard</h1>
        {challenge && <p className="text-muted-foreground text-sm">{challenge.title}</p>}
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn("ui-hover min-h-10 shrink-0 rounded-xl border px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary/40", filter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {(truncated.submissions || (filter !== "all" && truncated.weeklyVotes)) && (
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          This leaderboard is showing a capped data set, so some rankings or vote totals may be incomplete.
        </div>
      )}

      <div className="space-y-2">
        {ranked.map((s, i) => (
          <Link
            key={s.id}
            to={`/challenge/${challengeId}/submission/${s.id}`}
            className={cn(
              "ui-hover flex min-h-[68px] items-center gap-3 rounded-2xl border p-3 transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
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
        {ranked.length === 0 && <p className="ui-surface rounded-3xl border border-dashed border-border px-4 py-12 text-center text-muted-foreground">No submissions yet.</p>}
      </div>
    </div>
  );
}
