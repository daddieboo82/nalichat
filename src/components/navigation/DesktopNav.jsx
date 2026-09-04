import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/notifications/NotificationBell";
import {
  Home, MessageSquare, Compass, Music, FileText, BarChart3, Trophy, Users,
  Settings, LogOut, LogIn, HelpCircle, UserPlus, Mic, Radio, ShoppingCart,
  Wand2, AudioLines, Plus, Gem, Swords, Rocket
} from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";
import { sounds } from "@/hooks/use-sound";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const NAV_GROUPS = [
  {
    label: "Discover",
    items: [
      { icon: Home, label: "Home", path: "/" },
      { icon: Compass, label: "Explore", path: "/explore" },
    ],
  },
  {
    label: "Create",
    items: [
      { icon: Mic, label: "Studio", path: "/studio" },
      { icon: Wand2, label: "Cover Art", path: "/cover-art" },
      { icon: Radio, label: "Record", path: "/record" },
    ],
  },
  {
    label: "Connect",
    items: [
      { icon: MessageSquare, label: "Messages", path: "/messages" },
      { icon: Users, label: "Projects", path: "/projects-summary" },
    ],
  },
  {
    label: "Library",
    items: [
      { icon: Music, label: "Playlists", path: "/playlists" },
      { icon: FileText, label: "Files", path: "/files" },
    ],
  },
  {
    label: "Grow",
    items: [
      { icon: Swords, label: "Challenges", path: "/challenges" },
      { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
      { icon: BarChart3, label: "Analytics", path: "/analytics" },
      { icon: Rocket, label: "ViralSeed", path: "/viral-seed" },
    ],
  },
];

export default function DesktopNav({ onMessageClick, onInviteClick, onHelpClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const { items, setIsOpen } = useCart();
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    navigate("/", { replace: true });
    logout();
  };

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isActive = (path) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <nav
      className="hidden lg:block relative z-50 border-t border-white/[0.06] backdrop-blur-xl"
      style={{ background: "hsl(240 8% 6% / 0.95)" }}
    >
      <div className="w-full px-3 py-2 flex items-center justify-between gap-2">
        {/* Logo */}
        <Link to="/" className="group shrink-0">
          <div className="flex items-center gap-2">
            <img
              src="https://media.base44.com/images/public/6a1f5ee134147461560c2b37/e95b14649_generated_image.png"
              alt="NaliChat Logo"
              className="w-8 h-8 rounded-xl object-cover shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform"
            />
            <span className="font-heading font-bold text-sm text-gradient-animate hidden xl:inline">NaliChat</span>
          </div>
        </Link>

        {/* All Features — grouped with separators */}
        <div className="flex items-center justify-center flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-0.5 px-1">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className="flex items-center gap-0.5 shrink-0">
              {gi > 0 && <div className="w-px h-5 bg-white/[0.08] mx-1 shrink-0" />}
              {group.items.map(({ icon: Icon, label, path }) => {
                const active = isActive(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    title={label}
                    onClick={() => sounds.nav()}
                    className={cn(
                      "relative px-1.5 py-2 rounded-lg flex items-center gap-1 transition-all whitespace-nowrap text-xs font-semibold group shrink-0",
                      active
                        ? "bg-primary/15 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    {active && (
                      <div className="absolute top-0 inset-x-2 h-0.5 bg-primary rounded-b-full shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                    )}
                    <Icon className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", active && "text-primary")} />
                    <span className="hidden lg:inline">{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="border-l border-white/[0.08] h-6 mr-1" />

          {/* New Project */}
          <Link
            to="/projects-summary?new=true"
            title="New Project"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95 mr-0.5 shrink-0"
          >
            <Plus className="w-5 h-5" />
          </Link>

          {/* Cart */}
          <button
            onClick={() => setIsOpen(true)}
            title="Shopping Cart"
            className="relative w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
          >
            <ShoppingCart className="w-5 h-5" />
            {items.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center border-[1.5px] border-background">
                {items.length}
              </span>
            )}
          </button>

          {/* System */}
          <div className="border-l border-white/[0.08] pl-1.5 ml-1 flex items-center gap-1.5 shrink-0">
            <NotificationBell direction="up" />

            {/* Account */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title="Account & Settings"
                  className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all active:scale-95"
                >
                  {user ? (
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                        {user.full_name?.[0] || <Settings className="w-5 h-5" />}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Settings className="w-5 h-5" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-border/50">
                <DropdownMenuItem onClick={onInviteClick} className="cursor-pointer">
                  <UserPlus className="w-4 h-4 mr-2" /> Invite Friends
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onHelpClick} className="cursor-pointer">
                  <HelpCircle className="w-4 h-4 mr-2" /> Help
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/pricing" className="cursor-pointer">
                    <Gem className="w-4 h-4 mr-2 text-primary" /> Pricing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" /> Settings
                  </Link>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <BarChart3 className="w-4 h-4 mr-2" /> Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                {isAuthenticated ? (
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" /> Log out
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => navigate("/login")} className="cursor-pointer">
                    <LogIn className="w-4 h-4 mr-2" /> Log in
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* AI Assistant */}
            <button
              onClick={() => window.dispatchEvent(new Event("open-ai-assistant"))}
              title="NALI.ai Assistant"
              className="w-10 h-10 shrink-0 ml-0.5 rounded-xl flex items-center justify-center text-white bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <AudioLines className="w-5 h-5 animate-pulse" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}