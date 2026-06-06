import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Home, MessageSquare, Compass, Music, FileText, BarChart3, Trophy, Users, Settings, LogOut, LogIn, HelpCircle, UserPlus, Send, Mic, Radio, ShoppingCart, Wand2, AudioLines } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";
import { sounds } from "@/hooks/use-sound";

const ADMIN_EMAILS = ["bossglop43@gmail.com"];

const NAV_ITEMS = [
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Mic, label: "Studio", path: "/studio" },
  { icon: Wand2, label: "AI Cover", path: "/cover-art" },
  { icon: Music, label: "Playlists", path: "/playlists" },
  { icon: FileText, label: "Files", path: "/files" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
];

export default function DesktopNav({ onMessageClick, onInviteClick, onHelpClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const { items, setIsOpen } = useCart();
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    // Navigate to the public home route FIRST, then clear auth — this avoids a
    // race where ProtectedRoute redirects to /login at the same time, which left
    // the screen briefly blank during the exit animation.
    navigate("/", { replace: true });
    logout();
  };

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isActive = (path) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <nav className="hidden lg:block relative z-50 border-t border-border/50 backdrop-blur-xl" style={{ background: "hsl(240 8% 6% / 0.95)" }}>
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
        <div className="flex items-center justify-center flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-1 lg:gap-1.5 px-2">
          {NAV_ITEMS.map(({ icon: Icon, label, path }) => (
            <Link
              key={path}
              to={path}
              title={label}
              onClick={() => sounds.nav()}
              className={cn(
                "px-2.5 lg:px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap text-sm font-semibold group",
                isActive(path)
                  ? "bg-primary/15 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", isActive(path) && "text-primary")} />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Separator between labeled nav and icon actions */}
          <div className="border-l border-border/30 h-6 mr-1" />
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
            <NotificationBell direction="up" />
            <Link
              to="/settings"
              title="Settings"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
            >
              <Settings className="w-5 h-5" />
            </Link>
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                title="Log out"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95"
              >
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                title="Log in"
                className="h-9 px-4 rounded-full flex items-center gap-2 text-sm font-bold bg-primary/15 text-primary hover:bg-primary/25 transition-all active:scale-95"
              >
                <LogIn className="w-4 h-4" /> Log in
              </button>
            )}
            <button
              onClick={() => window.dispatchEvent(new Event('open-ai-assistant'))}
              title="NALI.ai Assistant"
              className="w-10 h-10 ml-1 rounded-xl flex items-center justify-center text-white bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <AudioLines className="w-5 h-5 animate-pulse" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}