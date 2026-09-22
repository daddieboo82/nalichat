import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, Music, AudioLines, LogIn, LogOut, Menu,
  Mic, Wand2, FileText, Trophy, Settings, Gem, BarChart3,
  Home, Compass, MessageSquare, Users, Radio, Swords, Rocket, Smartphone
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useAuth } from "@/lib/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { sounds } from "@/hooks/use-sound";
import { cn } from "@/lib/utils";
import RecentlyVisited from "@/components/navigation/RecentlyVisited";
import Logo from "@/components/branding/Logo";

const SUBPAGE_PREFIXES = ["/playlist/", "/record", "/settings", "/analytics"];

const TITLES = {
  "/": "Home",
  "/explore": "Explore",
  "/messages": "Messages",
  "/profile": "Profile",
  "/playlists": "Playlists",
  "/files": "Files",
  "/leaderboard": "Leaderboard",
  "/settings": "Settings",
  "/analytics": "Analytics",
  "/record": "Record",
  "/studio": "Studio",
  "/cover-art": "AI Cover Art",
};

const MENU_GROUPS = [
  {
    label: "Discover",
    items: [
      { icon: Home, label: "Home", path: "/", desc: "Dashboard & quick access" },
      { icon: Compass, label: "Explore", path: "/explore", desc: "Browse tracks & artists" },
    ],
  },
  {
    label: "Create",
    items: [
      { icon: Mic, label: "Studio", path: "/studio", desc: "Record & produce tracks" },
      { icon: Wand2, label: "AI Cover Art", path: "/cover-art", desc: "Generate album covers" },
      { icon: Radio, label: "Record", path: "/record", desc: "Quick voice recording" },
    ],
  },
  {
    label: "Connect",
    items: [
      { icon: MessageSquare, label: "Messages", path: "/messages", desc: "Chat & collaborate" },
      { icon: Users, label: "Projects", path: "/projects-summary", desc: "Manage collaborations" },
    ],
  },
  {
    label: "Library",
    items: [
      { icon: Music, label: "Playlists", path: "/playlists", desc: "Curate your collections" },
      { icon: FileText, label: "Files", path: "/files", desc: "Shared files & storage" },
    ],
  },
  {
    label: "Grow",
    items: [
      { icon: Swords, label: "Challenges", path: "/challenges", desc: "Remix competitions" },
      { icon: Trophy, label: "Leaderboard", path: "/leaderboard", desc: "Top creators & tracks" },
      { icon: BarChart3, label: "Analytics", path: "/analytics", desc: "Track your growth" },
      { icon: Rocket, label: "ViralSeed", path: "/viral-seed", desc: "Viral content engine" },
    ],
  },
];

export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const lastUserIdRef = useRef(user?.id || null);

  useEffect(() => {
    const nextUserId = user?.id || null;
    if (lastUserIdRef.current === nextUserId) return;
    lastUserIdRef.current = nextUserId;
    setMenuOpen(false);
  }, [user?.id]);

  const path = location.pathname;

  const ROOT_PATHS = new Set([
    "/", "/explore", "/messages", "/profile", "/files", "/leaderboard",
    "/playlists", "/settings", "/record", "/studio", "/cover-art",
    "/analytics", "/pricing", "/projects-summary", "/challenges", "/squad",
    "/admin", "/create-challenge", "/viral-seed",
  ]);
  const hasDynamicSegment = path.split("/").filter(Boolean).length > 1 && !ROOT_PATHS.has(path);
  const isSubPage = location.state?.from || hasDynamicSegment || !ROOT_PATHS.has(path) || location.search.length > 0;

  const title =
    TITLES[path] ||
    Object.entries(TITLES).find(([k]) => k !== "/" && path.startsWith(k))?.[1] ||
    "NaliBase";

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const handleNavigate = (dest) => {
    sounds.nav();
    setMenuOpen(false);
    navigate(dest);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  const isActive = (p) => path === p || (p !== "/" && path.startsWith(p));

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-white/[0.08] bg-card/85 backdrop-blur-xl select-none lg:hidden shadow-sm shadow-black/10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center justify-between gap-2 px-2 sm:px-3">
          {/* Left Section */}
          <div className="flex items-center gap-1 min-w-0">
            {isSubPage ? (
              <button
                onClick={handleBack}
                className="ui-hover -ml-1 flex h-11 w-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-primary/10 active:bg-primary/20 select-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={() => setMenuOpen(true)}
                className="ui-hover -ml-1 flex h-11 w-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-primary/10 active:bg-primary/20 select-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            <Logo size={30} className="mr-1" />
            <h1 className="font-heading font-extrabold text-base truncate tracking-tight">{title}</h1>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell />
            {!isAuthenticated && (
              <button
                onClick={() => navigate("/login")}
                className="h-11 px-3 rounded-full flex items-center gap-1 text-[11px] font-bold bg-primary text-primary-foreground active:scale-95 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" /> Log in
              </button>
            )}
            <button
              onClick={() => window.dispatchEvent(new Event("open-ai-assistant"))}
              title="Ask Nali"
              aria-label="Ask Nali, the AI assistant"
              className="ui-hover relative ml-1 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <AudioLines className="w-4 h-4 animate-pulse" />
            </button>
          </div>
        </div>
      </header>

      {/* Full Feature Menu Sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-[380px] overflow-y-auto border-r border-white/[0.08] bg-card/97 p-0 backdrop-blur-xl sm:max-w-sm">
          <SheetHeader className="p-4 pb-2 border-b border-white/[0.06]">
            <SheetTitle className="flex items-center gap-2">
              <Logo size={30} />
              <span className="font-heading font-extrabold text-gradient-animate tracking-tight">NaliBase</span>
            </SheetTitle>
            <SheetDescription className="sr-only">All features and navigation</SheetDescription>
          </SheetHeader>

          <div className="p-4 space-y-5">
            {/* Recently Visited */}
            <RecentlyVisited onNavigate={handleNavigate} currentPath={path} />

            {MENU_GROUPS.map((group) => (
              <div key={group.label}>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">
                  {group.label}
                </h3>
                <div className="space-y-1">
                  {group.items.map(({ icon: Icon, label, path: itemPath, desc }) => {
                    const active = isActive(itemPath);
                    return (
                      <button
                        key={itemPath}
                        onClick={() => handleNavigate(itemPath)}
                        className={cn(
                          "ui-hover w-full min-h-[58px] flex items-center gap-3 p-2.5 rounded-xl transition-all text-left focus-visible:ring-2 focus-visible:ring-primary/40",
                          active
                            ? "bg-primary/15 text-primary"
                            : "hover:bg-secondary/50 text-foreground"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          active ? "bg-primary/20" : "bg-secondary/60"
                        )}>
                          <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{label}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Account actions — always reachable on iPhone/mobile. */}
            <div className="pt-3 border-t border-white/[0.06] space-y-1">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-destructive/10 text-left transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                    <LogOut className="w-4.5 h-4.5 text-destructive" style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-destructive">Log out</p>
                    <p className="text-[11px] text-muted-foreground">Sign out of this device</p>
                  </div>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleNavigate("/login")}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-primary/10 text-left transition-all"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <LogIn className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Log in</p>
                      <p className="text-[11px] text-muted-foreground">Access your NaliBase account</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleNavigate("/register")}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-primary/10 text-left transition-all"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Sign up</p>
                      <p className="text-[11px] text-muted-foreground">Create a NaliChat account</p>
                    </div>
                  </button>
                </>
              )}
            </div>

            {/* Footer items */}
            <div className="pt-3 border-t border-white/[0.06] space-y-1">
              <button
                onClick={() => handleNavigate("/download")}
                className="ui-hover min-h-[58px] w-full rounded-xl p-2.5 text-left transition-all hover:bg-secondary/50 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Download App</p>
                  <p className="text-[11px] text-muted-foreground">Android, iOS, Desktop</p>
                </div>
              </button>
              <button
                onClick={() => handleNavigate("/pricing")}
                className="ui-hover min-h-[58px] w-full rounded-xl p-2.5 text-left transition-all hover:bg-secondary/50 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Gem className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Pricing</p>
                  <p className="text-[11px] text-muted-foreground">Plans & features</p>
                </div>
              </button>
              <button
                onClick={() => handleNavigate("/settings")}
                className="ui-hover min-h-[58px] w-full rounded-xl p-2.5 text-left transition-all hover:bg-secondary/50 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="w-9 h-9 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                  <Settings className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Settings</p>
                  <p className="text-[11px] text-muted-foreground">Profile & preferences</p>
                </div>
              </button>
              {user?.role === "admin" && (
                <button
                  onClick={() => handleNavigate("/admin")}
                  className="ui-hover min-h-[58px] w-full rounded-xl p-2.5 text-left transition-all hover:bg-secondary/50 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="w-9 h-9 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                    <BarChart3 className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Admin Dashboard</p>
                    <p className="text-[11px] text-muted-foreground">Manage platform</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}