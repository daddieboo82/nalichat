import { Outlet, Link, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/layout/PageTransition";
import { Settings, LogOut, Compass, Trophy, User, Mic, Sparkles, Music, BarChart3, FileText, MessageSquare, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import AiAssistant from "@/components/AiAssistant";
import NotificationBell from "@/components/notifications/NotificationBell";
import MobileHeader from "@/components/layout/MobileHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { useSystemTheme } from "@/hooks/use-system-theme";
import SoundToggle from "@/components/layout/SoundToggle";
import { sounds } from "@/hooks/use-sound";

const navItems = [
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Music, label: "Playlists", path: "/playlists" },
  { icon: FileText, label: "Files", path: "/files" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
  { icon: Users, label: "Network", path: "/network" },
  { icon: Mic, label: "Studio", path: "/studio" },
  { icon: Sparkles, label: "AI Editor", path: "/studio-editor" },
];

export default function AppLayout() {
  const location = useLocation();
  const [user, setUser] = useState(null);

  useSystemTheme();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header (Mobile) */}
      <MobileHeader />

      {/* Main Content — bottom padding on mobile clears the fixed bottom nav */}
      <main className="flex-1 overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <MobileBottomNav />

      {/* Bottom Navigation (Desktop) */}
      <nav className="hidden md:block relative z-50 border-t border-border/50 backdrop-blur-xl" style={{ background: "hsl(240 8% 6% / 0.95)" }}>
        <div className="max-w-7xl mx-auto px-3 py-1.5 flex items-center justify-between gap-2">
          {/* Logo + Branding */}
          <Link to="/" className="group shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary via-pink-500 to-accent flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
                <Music className="w-4 h-4 text-white" />
              </div>
              <span className="font-heading font-bold text-sm text-gradient-animate hidden lg:inline">NaliChat</span>
            </div>
          </Link>

          {/* Main Navigation */}
          <div className="flex items-center gap-0.5 flex-wrap justify-center flex-1">
            {navItems.map(({ icon: Icon, label, path }) => {
              const isActive = location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
              return (
                <Link
                  key={path}
                  to={path}
                  title={label}
                  onClick={() => sounds.nav()}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap text-xs font-medium group",
                    isActive
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                  <span className="hidden lg:inline">{label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <SoundToggle />
            <NotificationBell />
            <Link
              to="/profile"
              title="Profile"
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                location.pathname === "/profile"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <User className="w-4 h-4" />
            </Link>
            <Link
              to="/settings"
              title="Settings"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={() => base44.auth.logout()}
              title="Log out"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <Link to="/profile" className="ml-0.5">
              <Avatar className="w-8 h-8 border-2 border-border/50 hover:border-primary/50 transition-all cursor-pointer shadow-md">
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-pink-500 text-white text-xs font-bold">
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