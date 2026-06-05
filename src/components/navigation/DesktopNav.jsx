import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/notifications/NotificationBell";
import SoundToggle from "@/components/layout/SoundToggle";
import { Home, MessageSquare, Compass, Music, FileText, BarChart3, Trophy, Users, Settings, LogOut, HelpCircle, UserPlus, Send, Mic, Radio, ShoppingCart, Wand2 } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { sounds } from "@/hooks/use-sound";

const ADMIN_EMAILS = ["bossglop43@gmail.com"];

const NAV_ITEMS = [
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Mic, label: "Studio", path: "/studio" },
  { icon: Radio, label: "Record", path: "/record" },
  { icon: Wand2, label: "AI Cover", path: "/cover-art" },
  { icon: Music, label: "Playlists", path: "/playlists" },
  { icon: FileText, label: "Files", path: "/files" },
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
      <div className="w-full px-4 py-2 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="group shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary via-pink-500 to-accent flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
              <Music className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading font-bold text-sm text-gradient-animate hidden xl:inline">NaliChat</span>
          </div>
        </Link>

        {/* Main Navigation */}
        <div className="flex items-center justify-center flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-2 lg:gap-4 px-2">
          {NAV_ITEMS.map(({ icon: Icon, label, path }) => (
            <Link
              key={path}
              to={path}
              title={label}
              onClick={() => sounds.nav()}
              className={cn(
                "px-3 py-2 rounded-xl flex items-center gap-2 transition-all whitespace-nowrap text-sm font-semibold group",
                isActive(path)
                  ? "bg-primary/15 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", isActive(path) && "text-primary")} />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 shrink-0">
          {(!user || (user?.role !== "admin" && !ADMIN_EMAILS.includes(user?.email))) && (
            <Link
              to="/pricing"
              className="hidden lg:flex h-9 px-5 rounded-full bg-gradient-to-r from-primary to-accent text-white font-bold text-sm items-center hover:opacity-90 transition-opacity mr-2 shadow-lg shadow-primary/20"
            >
              {user ? "Upgrade to Pro" : "Pricing"}
            </Link>
          )}

          {/* Communication */}
          <Link
            to="/"
            title="Home"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
          >
            <Home className="w-5 h-5" />
          </Link>
          <button
            onClick={onInviteClick}
            title="Invite Collaborators"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
          >
            <UserPlus className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsOpen(true)}
            title="Shopping Cart"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
          >
            <ShoppingCart className="w-5 h-5" />
            {items.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center border-[1.5px] border-background">
                {items.length}
              </span>
            )}
          </button>

          {/* System */}
          <div className="border-l border-border/30 pl-2 ml-1 flex items-center gap-1.5">
            <button
              onClick={onHelpClick}
              title="Help"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <SoundToggle />
            <NotificationBell direction="up" />
            <Link
              to="/settings"
              title="Settings"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
            >
              <Settings className="w-5 h-5" />
            </Link>
            <button
              onClick={() => base44.auth.logout()}
              title="Log out"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95"
            >
              <LogOut className="w-5 h-5" />
            </button>

            {/* Profile Avatar */}
            <Link to="/profile" className="ml-2">
              <Avatar className="w-10 h-10 border-2 border-border/50 hover:border-primary/50 transition-all cursor-pointer shadow-md">
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-pink-500 text-white text-sm font-bold">
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