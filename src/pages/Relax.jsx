import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TonightsPicks from "@/components/relax/TonightsPicks";
import CinemaPlayer from "@/components/relax/CinemaPlayer";
import { sounds } from "@/hooks/use-sound";
import { toast } from "sonner";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Relax() {
  const [currentUser, setCurrentUser] = useState(null);
  const [cinemaMovie, setCinemaMovie] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);
  const isAdmin = currentUser?.role === "admin";

  // Today's 3 daily movies — auto-generate via AI if today's batch doesn't exist.
  const { data: dailyMovies = [], isLoading: dailyLoading } = useQuery({
    queryKey: ["dailyMovies", todayStr()],
    queryFn: async () => {
      const existing = await base44.entities.DailyMovie.filter({ pick_date: todayStr() }, "slot", 3);
      if (existing.length >= 3) return existing;
      const res = await base44.functions.invoke("refreshDailyMovies", {});
      return res?.data?.movies || [];
    },
    staleTime: 1000 * 60 * 60,
  });

  const onPlayMovie = (movie) => { sounds.click(); setCinemaMovie(movie); };

  const refreshPicks = async () => {
    setRefreshing(true);
    try {
      const res = await base44.functions.invoke("refreshDailyMovies", { force: true });
      queryClient.setQueryData(["dailyMovies", todayStr()], res?.data?.movies || []);
      toast.success("Fresh picks loaded");
    } catch {
      toast.error("Could not refresh picks");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background pb-16">
      {/* Immersive cinema hero — pick 1 of 3 daily public-domain movies */}
      <TonightsPicks
        movies={dailyMovies}
        loading={dailyLoading || refreshing}
        onPlay={onPlayMovie}
        onRefresh={refreshPicks}
        isAdmin={isAdmin}
      />

      {cinemaMovie && <CinemaPlayer movie={cinemaMovie} onClose={() => setCinemaMovie(null)} />}
    </div>
  );
}