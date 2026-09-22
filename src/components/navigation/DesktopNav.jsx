import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/notifications/NotificationBell";
import {
  Home, MessageSquare, Compass, Music, FileText, BarChart3, Trophy, Users,
  Settings, LogOut, LogIn, HelpCircle, UserPlus, Mic, Radio, Film,
  Wand2, AudioLines, Plus, Gem, Swords, Rocket, Smartphone
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { sounds } from "@/hooks/use-sound";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Logo from "@/components/branding/Logo";
import { Button } from "@/components/ui/button";

const NAV_GROUPS = [
  { label: "NaliBase Worlds", items: [
    { icon: MessageSquare, label: "Connect", path: "/world/connect" },
    { icon: Music, label: "Create", path: "/world/create" },
    { icon: Compass, label: "Discover", path: "/world/discover" },
    { icon: FileText, label: "Share", path: "/world/share" },
    { icon: Film, label: "Visualize", path: "/world/visualize" },
    { icon: Trophy, label: "Compete", path: "/world/compete" },
  ]},
];

export default function DesktopNav({ onMessageClick, onInviteClick, onHelpClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };


  const isActive = (path) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <nav
      className="relative z-50 hidden border-t border-white/[0.08] shadow-[0_-1px_18px_rgba(0,0,0,0.12)] backdrop-blur-xl lg:block"
      style={{ background: "hsl(240 8% 6% / 0.95)" }}
    >
      <div className="flex min-h-14 w-full items-center justify-between gap-2 px-3 py-2">
        {/* Logo */}
        <Link to="/" className="ui-hover shrink-0 rounded-xl px-1.5 py-1 focus-visible:ring-2 focus-visible:ring-primary/40">
          <div className="flex items-center gap-2">
            <Logo size={30} className="group-hover:scale-105 transition-transform shadow-lg shadow-primary/30" />
            <span className="font-heading font-extrabold text-sm text-gradient-animate hidden xl:inline tracking-tight">NaliBase</span>
          </div>
        </Link>

        {/* NaliBase world entrances */}
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
                      "ui-hover group relative flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2 py-2 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-primary/40",
                      active
                        ? "bg-primary/15 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    {active && (
                      <div className="absolute top-0 inset-x-2 h-0.5 bg-primary rounded-b-full shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                    )}
                    <Icon className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", active && "text-primary")} />
                    <span className="hidden 2xl:inline">{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="border-l border-white/[0.08] h-6 mr-1" />

          {/* Auth CTAs — the only login/signup entry point was previously a
              single "Log in" item buried in the Account dropdown behind a
              generic gear icon, with no signup option at all. Mirror the
              mobile header's visible pill so anonymous visitors have an
              obvious way in. */}
          {!isAuthenticated && (
            <div className="flex items-center gap-1.5 mr-1 shrink-0">
              <Link
                to="/login"
                onClick={() => sounds.nav()}
                className="ui-hover min-h-10 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground transition-all hover:bg-secondary/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Log in
              </Link>
              <Link to="/register" onClick={() => sounds.nav()}>
                <Button size="sm" className="ui-hover min-h-10 whitespace-nowrap rounded-xl bg-gradient-to-r from-primary to-pink-500 text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90">
                  Sign up
                </Button>
              </Link>
            </div>
          )}

          {/* New Project */}
          <Link
            to="/projects-summary?new=true"
            title="New Project"
            className="ui-hover mr-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-pink-500 text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Plus className="w-5 h-5" />
          </Link>

          {/* System */}
          <div className="border-l border-white/[0.08] pl-1.5 ml-1 flex items-center gap-1.5 shrink-0">
            <NotificationBell direction="up" />

            {/* Account */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title="Account & Settings"
                  className="ui-hover flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-secondary/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
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
              <DropdownMenuContent align="end" className="w-52 rounded-2xl border-border/50 bg-card/95 p-1.5 backdrop-blur-xl">
                <DropdownMenuItem onClick={onInviteClick} className="min-h-10 cursor-pointer rounded-xl">
                  <UserPlus className="w-4 h-4 mr-2" /> Invite Friends
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onHelpClick} className="min-h-10 cursor-pointer rounded-xl">
                  <HelpCircle className="w-4 h-4 mr-2" /> Help
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/download" className="min-h-10 cursor-pointer rounded-xl">
                    <Smartphone className="w-4 h-4 mr-2" /> Download App
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/pricing" className="min-h-10 cursor-pointer rounded-xl">
                    <Gem className="w-4 h-4 mr-2 text-primary" /> Pricing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="min-h-10 cursor-pointer rounded-xl">
                    <Settings className="w-4 h-4 mr-2" /> Settings
                  </Link>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="min-h-10 cursor-pointer rounded-xl">
                      <BarChart3 className="w-4 h-4 mr-2" /> Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                {isAuthenticated ? (
                  <DropdownMenuItem onClick={handleLogout} className="min-h-10 cursor-pointer rounded-xl text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" /> Log out
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => navigate("/login")} className="min-h-10 cursor-pointer rounded-xl">
                    <LogIn className="w-4 h-4 mr-2" /> Log in
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* AI Assistant */}
            <button
              onClick={() => window.dispatchEvent(new Event("open-ai-assistant"))}
              title="NALI.ai Assistant"
              className="ui-hover ml-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <AudioLines className="w-5 h-5 animate-pulse" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}