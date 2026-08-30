import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import CountdownTimer from "./CountdownTimer";
import { Trophy } from "lucide-react";

const STATUS_LABEL = { upcoming: "Upcoming", active: "Live", voting: "Voting Open", completed: "Completed" };

export default function ChallengeCard({ challenge, winner, dimmed }) {
  return (
    <Link
      to={`/challenge/${challenge.id}`}
      className={`block rounded-2xl overflow-hidden bg-card border border-border hover:border-primary/40 transition-all ${dimmed ? "opacity-60" : "hover:-translate-y-1"}`}
    >
      <div className="relative aspect-video bg-secondary">
        {challenge.cover_url && (
          <img src={challenge.cover_url} alt={challenge.title} className="w-full h-full object-cover" />
        )}
        <Badge className="absolute top-2 left-2 bg-black/60 text-white border-none">
          {STATUS_LABEL[challenge.status] || challenge.status}
        </Badge>
        {winner && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-yellow-500/90 text-black text-xs font-bold px-2 py-1 rounded-full">
            <Trophy className="w-3 h-3" /> {winner.producer_name}
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <h3 className="font-heading font-bold text-sm truncate">{challenge.title}</h3>
        <p className="text-xs text-muted-foreground truncate">by {challenge.host_artist_name}</p>
        {challenge.status === "upcoming" && challenge.start_date && (
          <p className="text-xs text-primary">Starts {new Date(challenge.start_date).toLocaleDateString()}</p>
        )}
        {challenge.status === "active" && challenge.submission_end_date && (
          <CountdownTimer targetDate={challenge.submission_end_date} label="Closes in" />
        )}
      </div>
    </Link>
  );
}