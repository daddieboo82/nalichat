import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/notifications/NotificationBell";
import SoundToggle from "@/components/layout/SoundToggle";
import { MessageSquare, Compass, Music, FileText, BarChart3, Trophy, Users, Settings, LogOut, HelpCircle, UserPlus, Send, Mic, ShoppingCart, Wand2 } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { sounds } from "@/hooks/use-sound";

const NAV_ITEMS = [
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Mic, label: "Studio", path: "/studio" },
  { icon: Wand2, label: "AI Cover", path: "/cover-art" },
  { icon: Music, label: "Playlists", path: "/playlists" },
  { icon: FileText, label: "Files", path: "/files" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
];

export default function DesktopNav({ onMessageClick, onInviteClick, onHelpClick }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const { items, setIsOpen } = useCart();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isActive = (path) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <nav className="hidden md:block relative z-50 border-t border-border/50 backdrop-blur-xl" style={{ background: "hsl(240 8% 6% / 0.95)" }}>
      <div className="max-w-7xl mx-auto px-3 py-1.5 flex items-center justify-between gap-2">
        {/* Logo */}
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
          {NAV_ITEMS.map(({ icon: Icon, label, path }) => (
            <Link
              key={path}
              to={path}
              title={label}
              onClick={() => sounds.nav()}
              className={cn(
                "px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap text-xs font-medium group",
                isActive(path)
                  ? "bg-primary/15 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 transition-transform group-hover:scale-110", isActive(path) && "text-primary")} />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 shrink-0">
          {user?.role !== "admin" && (
            <Link
              to="/pricing"
              className="hidden lg:flex h-8 px-4 rounded-full bg-gradient-to-r from-primary to-accent text-white font-semibold text-xs items-center hover:opacity-90 transition-opacity mr-1 shadow-lg shadow-primary/20"
            >
              Upgrade to Pro
            </Link>
          )}

          {/* Communication */}
          <button
            onClick={onMessageClick}
            title="Send Message"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={onInviteClick}
            title="Invite Collaborators"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
          >
            <UserPlus className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={() => setIsOpen(true)}
            title="Shopping Cart"
            className="relative w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
          >
            <ShoppingCart className="w-4.5 h-4.5" />
            {items.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center border-2 border-background">
                {items.length}
              </span>
            )}
          </button>

          {/* System */}
          <div className="border-l border-border/30 pl-2 flex items-center gap-2">
            <button
              onClick={onHelpClick}
              title="Help"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
            >
              <HelpCircle className="w-4.5 h-4.5" />
            </button>
            <SoundToggle />
            <NotificationBell direction="up" />
            <Link
              to="/settings"
              title="Settings"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
            >
              <Settings className="w-4.5 h-4.5" />
            </Link>
            <button
              onClick={() => base44.auth.logout()}
              title="Log out"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>

            {/* Profile Avatar */}
            <Link to="/profile" className="ml-1">
              <Avatar className="w-9 h-9 border-2 border-border/50 hover:border-primary/50 transition-all cursor-pointer shadow-md">
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-pink-500 text-white text-xs font-bold">
                  {user?.display_name?.[0] || user?.full_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}