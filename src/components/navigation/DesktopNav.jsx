import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Home, MessageSquare, Compass, Music, FileText, BarChart3, Trophy, Users, Settings, LogOut, LogIn, HelpCircle, UserPlus, Send, Mic, Radio, ShoppingCart, Wand2, AudioLines, Plus, Gem } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";
import { sounds } from "@/hooks/use-sound";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";

const MAIN_NAV_ITEMS = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Mic, label: "Studio", path: "/studio" },
];

const MORE_NAV_ITEMS = [
  { icon: Gem, label: "Pricing", path: "/pricing" },
  { icon: Music, label: "Playlists", path: "/playlists" },
  { icon: Wand2, label: "AI Cover", path: "/cover-art" },
  { icon: FileText, label: "Files", path: "/files" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
  { icon: Users, label: "Collaborations", path: "/projects-summary" },
  { icon: BarChart3, label: "Admin", path: "/admin" },
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
            <img src="https://media.base44.com/images/public/6a1f5ee134147461560c2b37/e95b14649_generated_image.png" alt="NaliChat Logo" className="w-8 h-8 rounded-xl object-cover shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform" />
            <span className="font-heading font-bold text-sm text-gradient-animate hidden xl:inline">NaliChat</span>
          </div>
        </Link>

        {/* Main Navigation */}
        <div className="flex items-center justify-center flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-1 lg:gap-1.5 px-2">
          {MAIN_NAV_ITEMS.map(({ icon: Icon, label, path }) => (
            <Link
              key={path}
              to={path}
              title={label}
              onClick={() => sounds.nav()}
              className={cn(
                "relative px-2.5 xl:px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap text-sm font-semibold group shrink-0",
                isActive(path)
                  ? "bg-primary/15 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {isActive(path) && (
                <div className="absolute top-0 inset-x-2 h-0.5 bg-primary rounded-b-full shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
              )}
              <Icon className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", isActive(path) && "text-primary")} />
              <span className="hidden xl:inline">{label}</span>
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "relative px-2.5 xl:px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap text-sm font-semibold group shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  MORE_NAV_ITEMS.some(item => isActive(item.path)) && "bg-primary/15 text-primary shadow-sm"
                )}
              >
                {MORE_NAV_ITEMS.some(item => isActive(item.path)) && (
                  <div className="absolute top-0 inset-x-2 h-0.5 bg-primary rounded-b-full shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                )}
                <Menu className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", MORE_NAV_ITEMS.some(item => isActive(item.path)) && "text-primary")} />
                <span className="hidden xl:inline">More</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48 bg-card/95 backdrop-blur-xl border-border/50">
              {MORE_NAV_ITEMS.map(({ icon: Icon, label, path }) => (
                <DropdownMenuItem key={path} asChild>
                  <Link
                    to={path}
                    onClick={() => sounds.nav()}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer w-full",
                      isActive(path) && "text-primary focus:text-primary"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1 xl:gap-2 shrink-0">
          {/* Separator between labeled nav and icon actions */}
          <div className="border-l border-border/30 h-6 mr-1" />
          {/* Communication */}
          <Link
            to="/explore?upload=true"
            title="Release Track"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95 mr-1 shrink-0"
          >
            <Plus className="w-5 h-5" />
          </Link>

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
          <div className="border-l border-border/30 pl-2 ml-1 flex items-center gap-1.5 shrink-0">
            <NotificationBell direction="up" />
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
                    <Gem className="w-4 h-4 mr-2 text-primary" /> Upgrade / Plans
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" /> Settings
                  </Link>
                </DropdownMenuItem>
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
            <button
              onClick={() => window.dispatchEvent(new Event('open-ai-assistant'))}
              title="NALI.ai Assistant"
              className="w-10 h-10 shrink-0 ml-1 rounded-xl flex items-center justify-center text-white bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <AudioLines className="w-5 h-5 animate-pulse" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}