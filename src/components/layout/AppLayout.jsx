import { Outlet, Link, useLocation } from "react-router-dom";
import { MessageSquare, Users, Settings, LogOut, Compass, Trophy, User, Mic, Sparkles, Music, BarChart3 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import AiAssistant from "@/components/AiAssistant";

const navItems = [
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Music, label: "Playlists", path: "/playlists" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
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
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="border-t border-border bg-card/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo + Branding */}
          <Link to="/" className="group shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="text-white font-heading font-black text-xs">NC</span>
              </div>
              <span className="font-heading font-bold text-sm text-foreground hidden sm:inline">NaliChat</span>
            </div>
          </Link>

          {/* Main Navigation */}
          <div className="flex items-center gap-1">
            {navItems.map(({ icon: Icon, label, path }) => {
              const isActive = location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  title={label}
                  className={cn(
                    "px-3 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap text-sm group",
                    isActive
                      ? "bg-primary/20 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              to="/profile"
              title="Profile"
              className={cn(
                "p-2 rounded-lg transition-all",
                location.pathname === "/profile"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
              )}
            >
              <User className="w-4 h-4" />
            </Link>
            <Link
              to="/settings"
              title="Settings"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={() => base44.auth.logout()}
              title="Log out"
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <Link to="/profile" className="ml-2">
              <Avatar className="w-7 h-7 border border-border hover:border-primary transition-colors cursor-pointer">
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {user?.display_name?.[0] || user?.full_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </nav>

      {/* Omnipresent AI */}
      <AiAssistant />
    </div>
  );
}