import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import CountdownTimer from "@/components/challenges/CountdownTimer";
import { Link } from "react-router-dom";
import { Trophy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

export default function ChallengeHub() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [winners, setWinners] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Challenge.list("-created_date").then(async (list) => {
      setChallenges(list);
      const completed = list.filter((c) => c.status === "completed");
      const winnerMap = {};
      await Promise.all(
        completed.map(async (c) => {
          const top = await base44.entities.ChallengeSubmission.filter({ challenge_id: c.id }, "-vote_count", 1);
          if (top[0]) winnerMap[c.id] = top[0];
        })
      );
      setWinners(winnerMap);
      setLoading(false);
    });
  }, []);

  const featured = challenges.find((c) => c.status === "active") || challenges.find((c) => c.status === "voting");
  const upcoming = challenges.filter((c) => c.status === "upcoming");
  const past = challenges.filter((c) => c.status === "completed");

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gradient-animate">Remix Challenges</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload a source track, remix, and vote for the community's best.</p>
        </div>
        {user && (
          <Link to="/create-challenge">
            <Button className="rounded-full gap-1.5 bg-gradient-to-r from-primary to-accent text-white"><Plus className="w-4 h-4" /> Create Challenge</Button>
          </Link>
        )}
      </div>

      {featured && (
        <Link to={`/challenge/${featured.id}`} className="block rounded-3xl overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 hover:border-primary/60 transition-all">
          <div className="relative aspect-[16/7] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {upcoming.map((c) => <ChallengeCard key={c.id} challenge={c} dimmed />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-heading font-bold text-lg mb-3 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Past Challenges</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {past.map((c) => <ChallengeCard key={c.id} challenge={c} winner={winners[c.id]} />)}
          </div>
        </section>
      )}

      {challenges.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No challenges yet — check back soon!</p>
      )}
    </div>
  );
}