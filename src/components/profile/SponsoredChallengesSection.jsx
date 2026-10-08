import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import SponsorBadge from "@/components/challenges/SponsorBadge";
import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";

/**
 * Displays sponsored challenges hosted by this creator on their profile.
 * Shows nothing when the user has no sponsored challenges.
 */
export default function SponsoredChallengesSection({ userId }) {
  const { data: challenges = [] } = useQuery({
    queryKey: ["sponsored-challenges", userId],
    queryFn: async () => {
      const page = await base44.entities.Challenge.filter(
        { host_artist_id: userId, is_sponsored: true },
        { sort: "-created_date", limit: 10 }
      );
      return page.items || [];
    },
    enabled: !!userId,
  });

  if (!challenges.length) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Trophy className="w-3.5 h-3.5 text-amber-400" />
        Sponsored Challenges
      </span>
      {challenges.map((challenge) => (
        <Link
          key={challenge.id}
          to={`/challenge/${challenge.id}`}
          className="ui-hover inline-block"
        >
          <SponsorBadge challenge={challenge} size="sm" />
        </Link>
      ))}
    </div>
  );
}