import { Outlet, Link, useLocation } from "react-router-dom";
import { MessageSquare, Users, Settings, LogOut, Compass, Trophy, User, Mic, Sparkles, Music } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import AiAssistant from "@/components/AiAssistant";

const navItems = [
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Music, label: "Playlists", path: "/playlists" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
  { icon: Users, label: "Network", path: "/network" },
  { icon: Mic, label: "Studio", path: "/studio" },
  { icon: Sparkles, label: "AI Editor", path: "/studio-editor" },
];

export default function AppLayout() {
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[72px] bg-card border-r border-border flex flex-col items-center py-4 gap-1 shrink-0">
        {/* Logo */}
        <Link to="/" className="mb-4 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-white font-heading font-black text-sm">RS</span>
          </div>
        </Link>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                title={label}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary/20 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="w-5 h-5" />
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full -ml-[1px]" />}
                <span className="absolute left-14 bg-card border border-border text-foreground text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 font-medium shadow-lg">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-1 items-center">
          <Link
            to="/profile"
            title="Profile"
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
              location.pathname === "/profile" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <User className="w-5 h-5" />
          </Link>
          <Link
            to="/settings"
            title="Settings"
            className="w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <Settings className="w-5 h-5" />
          </Link>
          <button
            onClick={() => base44.auth.logout()}
            title="Log out"
            className="w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <Link to="/profile" className="mt-1">
            <Avatar className="w-9 h-9 border-2 border-border hover:border-primary transition-colors cursor-pointer">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                {user?.display_name?.[0] || user?.full_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Omnipresent AI */}
      <AiAssistant />
    </div>
  );
}