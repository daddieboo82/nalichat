import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, Music, ShoppingCart, AudioLines, LogIn, Menu,
  Mic, Wand2, FileText, Trophy, Settings, Gem, BarChart3,
  Home, Compass, MessageSquare, Users, Radio, X
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { sounds } from "@/hooks/use-sound";
import { cn } from "@/lib/utils";

const SUBPAGE_PREFIXES = ["/playlist/", "/record", "/settings", "/analytics"];

const TITLES = {
  "/": "Home",
  "/explore": "Explore",
  "/messages": "Messages",
  "/profile": "Profile",
  "/playlists": "Playlists",
  "/files": "Files",
  "/leaderboard": "Leaderboard",
  "/network": "Network",
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
      { icon: Trophy, label: "Leaderboard", path: "/leaderboard", desc: "Top creators & tracks" },
      { icon: BarChart3, label: "Analytics", path: "/analytics", desc: "Track your growth" },
    ],
  },
];

export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const { items, setIsOpen } = useCart();
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const path = location.pathname;

  const rootTabs = [
    "/", "/explore", "/messages", "/profile", "/files", "/leaderboard",
    "/playlists", "/settings", "/record", "/studio", "/cover-art",
    "/network", "/analytics", "/pricing", "/business",
  ];
  const isRootTab = rootTabs.includes(path) && !location.search;
  const isSubPage = location.state?.from || !isRootTab || location.search.length > 0;

  const title =
    TITLES[path] ||
    Object.entries(TITLES).find(([k]) => k !== "/" && path.startsWith(k))?.[1] ||
    "NaliChat";

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

  const isActive = (p) => path === p || (p !== "/" && path.startsWith(p));

  return (
    <>
      <header
        className="lg:hidden sticky top-0 z-40 border-b border-white/[0.06] bg-card/70 backdrop-blur-md select-none"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-2 h-12 flex items-center justify-between gap-2">
          {/* Left Section */}
          <div className="flex items-center gap-1 min-w-0">
            {isSubPage ? (
              <button
                onClick={handleBack}
                className="p-1.5 -ml-1 rounded-lg text-foreground hover:bg-primary/10 active:bg-primary/20 transition-colors select-none"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={() => setMenuOpen(true)}
                className="p-1.5 -ml-1 rounded-lg text-foreground hover:bg-primary/10 active:bg-primary/20 transition-colors select-none"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            <img
              src="https://media.base44.com/images/public/6a1f5ee134147461560c2b37/e95b14649_generated_image.png"
              alt="NaliChat Logo"
              className="w-8 h-8 object-cover rounded-lg mr-1"
            />
            <h1 className="font-heading font-bold text-base truncate">{title}</h1>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsOpen(true)}
              className="relative p-1.5 rounded-lg hover:bg-primary/10 transition-all text-muted-foreground hover:text-foreground"
            >
              <ShoppingCart className="w-5 h-5" />
              {items.length > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-[8px] font-bold text-white flex items-center justify-center border border-background">
                  {items.length}
                </span>
              )}
            </button>
            <NotificationBell />
            {!isAuthenticated && (
              <button
                onClick={() => navigate("/login")}
                className="h-7 px-3 rounded-full flex items-center gap-1 text-[11px] font-bold bg-primary/15 text-primary active:scale-95 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" /> Log in
              </button>
            )}
            <button
              onClick={() => window.dispatchEvent(new Event("open-ai-assistant"))}
              className="relative p-1.5 ml-1 rounded-lg flex items-center justify-center text-white bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <AudioLines className="w-4 h-4 animate-pulse" />
            </button>
          </div>
        </div>
      </header>

      {/* Full Feature Menu Sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[85vw] sm:max-w-sm p-0 bg-card/95 backdrop-blur-xl border-r border-white/[0.06] overflow-y-auto">
          <SheetHeader className="p-4 pb-2 border-b border-white/[0.06]">
            <SheetTitle className="flex items-center gap-2">
              <img
                src="https://media.base44.com/images/public/6a1f5ee134147461560c2b37/e95b14649_generated_image.png"
                alt="NaliChat Logo"
                className="w-8 h-8 rounded-xl object-cover"
              />
              <span className="font-heading font-bold text-gradient-animate">NaliChat</span>
            </SheetTitle>
            <SheetDescription className="sr-only">All features and navigation</SheetDescription>
          </SheetHeader>

          <div className="p-4 space-y-5">
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
                          "w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left",
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

            {/* Footer items */}
            <div className="pt-3 border-t border-white/[0.06] space-y-1">
              <button
                onClick={() => handleNavigate("/pricing")}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 text-left transition-all"
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
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 text-left transition-all"
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
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 text-left transition-all"
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