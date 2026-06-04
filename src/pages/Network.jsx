import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MessageSquare, Music, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const roleColors = {
  artist: "bg-primary/20 text-primary border-primary/30",
  producer: "bg-accent/20 text-accent border-accent/30",
  engineer: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  ar: "bg-chart-3/20 text-chart-3 border-chart-3/30",
};

const roleIcons = {
  artist: "🎤",
  producer: "🎹",
  engineer: "🎛️",
  ar: "📋",
};

export default function Network() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const navigate = useNavigate();

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const [currentUser, setCurrentUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const filtered = users.filter(u => {
    if (u.id === currentUser?.id) return false;
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    const q = search.toLowerCase();
    return (u.display_name || u.full_name || "").toLowerCase().includes(q) ||
           (u.genres || []).some(g => g.toLowerCase().includes(q)) ||
           (u.location || "").toLowerCase().includes(q);
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-heading font-bold mb-1">Network</h1>
        <p className="text-sm text-muted-foreground mb-6">Connect with artists, producers, engineers & A&Rs</p>
        
        <div className="flex flex-col gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, genre, or location..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-0 rounded-xl" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {["all", "artist", "producer", "engineer", "ar"].map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap capitalize shrink-0 transition-colors ${roleFilter === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                {r === "all" ? "All" : r === "ar" ? "A&R" : r.charAt(0).toUpperCase() + r.slice(1) + "s"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl border border-border p-5 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start gap-4">
                <Avatar className="w-14 h-14 rounded-xl">
                  <AvatarImage src={user.avatar_url} className="rounded-xl" />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg rounded-xl">
                    {(user.display_name || user.full_name || "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-heading font-semibold truncate">{user.display_name || user.full_name}</p>
                    <span className="text-base">{roleIcons[user.role]}</span>
                  </div>
                  <Badge className={`text-[10px] mt-1 border ${roleColors[user.role] || "bg-secondary text-secondary-foreground"}`}>
                    {user.role?.toUpperCase()}
                  </Badge>
                </div>
              </div>
              
              {user.bio && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{user.bio}</p>}
              
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {user.location && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="w-3 h-3" /> {user.location}
                  </span>
                )}
                {user.genres?.slice(0, 3).map(g => (
                  <Badge key={g} variant="outline" className="text-[10px] border-border">
                    <Music className="w-2.5 h-2.5 mr-1" /> {g}
                  </Badge>
                ))}
              </div>

              <Button
                className="w-full mt-4 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border-0"
                variant="outline"
                size="sm"
                onClick={() => navigate("/messages")}
              >
                <MessageSquare className="w-4 h-4 mr-2" /> Message
              </Button>
            </motion.div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-20">
            <p className="text-lg font-heading">No users found</p>
            <p className="text-sm mt-1">Try a different search or filter</p>
          </div>
        )}
      </div>
    </div>
  );
}