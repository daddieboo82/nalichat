import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import CountdownTimer from "@/components/challenges/CountdownTimer";
import { Link } from "react-router-dom";
import { Trophy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import PullToRefresh from "@/components/layout/PullToRefresh";
import LoadError from "@/components/layout/LoadError";

async function listAllChallenges() {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.Challenge.list(
      "-created_date",
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function ChallengeHub() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [winners, setWinners] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const refresh = async () => {
    // Without this guard a rejected request skipped setLoading(false) and left
    // the page spinning forever with no error and no way to retry.
    setLoadError(false);
    try {
      const list = await listAllChallenges();
      setChallenges(list || []);
      const completed = (list || []).filter((c) => c.status === "completed");
      const winnerMap = {};
      await Promise.all(
        completed.map(async (c) => {
          try {
            const top = await base44.entities.ChallengeSubmission.filter({ challenge_id: c.id }, "-vote_count", 1);
            if (top[0]) winnerMap[c.id] = top[0];
          } catch (e) {
            // A missing winner shouldn't sink the whole page.
            console.error("Failed to load challenge winner", e);
          }
        })
      );
      setWinners(winnerMap);
    } catch (e) {
      console.error("Failed to load challenges", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const featured = challenges.find((c) => c.status === "active") || challenges.find((c) => c.status === "voting");
  const upcoming = challenges.filter((c) => c.status === "upcoming");
  const past = challenges.filter((c) => c.status === "completed");

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (loadError) {
    return (
      <LoadError
        title="Couldn't load challenges"
        message="We couldn't reach the challenge list. Check your connection and try again."
        onRetry={() => { setLoading(true); refresh(); }}
      />
    );
  }

  return (
    <PullToRefresh onRefresh={refresh} className="mx-auto max-w-5xl space-y-7 px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:p-6 sm:space-y-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gradient-animate">Remix Challenges</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload a source track, remix, and vote for the community's best.</p>
        </div>
        {user && (
          <Button className="ui-hover min-h-11 gap-1.5 rounded-xl bg-gradient-to-r from-primary to-accent px-4 font-semibold text-white shadow-lg shadow-primary/10" asChild>
            <Link to="/create-challenge"><Plus className="w-4 h-4" /> Create Challenge</Link>
            </Button>
        )}
      </div>

      {featured && (
        <Link to={`/challenge/${featured.id}`} className="ui-surface ui-hover block overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 transition-all hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40">
          <div className="relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20 sm:aspect-[16/7]">
            {featured.cover_url ? (
              <img src={featured.cover_url} alt={featured.title} className="w-full h-full object-cover" />
            ) : (
              <Trophy className="w-12 h-12 text-primary/30" />
            )}
          </div>
          <div className="p-4 sm:p-6 space-y-2">
            <h2 className="font-heading text-xl sm:text-2xl font-bold">{featured.title}</h2>
            <p className="text-sm text-muted-foreground">Hosted by {featured.host_artist_name}</p>
            {featured.submission_end_date && <CountdownTimer targetDate={featured.submission_end_date} label="Submissions close in" />}
          </div>
        </Link>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="font-heading font-bold text-lg mb-3">Upcoming</h2>
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3">
            {upcoming.map((c) => <ChallengeCard key={c.id} challenge={c} dimmed />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-heading font-bold text-lg mb-3 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Past Challenges</h2>
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3">
            {past.map((c) => <ChallengeCard key={c.id} challenge={c} winner={winners[c.id]} />)}
          </div>
        </section>
      )}

      {challenges.length === 0 && (
        <p className="ui-surface rounded-3xl border border-dashed border-border px-5 py-12 text-center text-muted-foreground">No challenges yet — check back soon!</p>
      )}
    </PullToRefresh>
  );
}