import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Music, ShoppingCart, AudioLines, LogIn, Menu, Mic, Wand2, FileText, Trophy, Settings } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const ADMIN_EMAILS = ["bossglop43@gmail.com"];

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

export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const { items, setIsOpen } = useCart();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const path = location.pathname;
  const isSubPage = SUBPAGE_PREFIXES.some((p) => path.startsWith(p) && p !== "/");
  const title = TITLES[path] || Object.entries(TITLES).find(([k]) => k !== "/" && path.startsWith(k))?.[1] || "NaliChat";

  return (
    <header
      className="lg:hidden sticky top-0 z-40 border-b border-border bg-card/70 backdrop-blur-md select-none"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-2 h-12 flex items-center justify-between gap-2">
        {/* Left Section */}
        <div className="flex items-center gap-1 min-w-0">
          {isSubPage ? (
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 -ml-1 rounded-lg text-foreground hover:bg-primary/10 active:bg-primary/20 transition-colors select-none"
              aria-label="Back"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 -ml-1 rounded-lg text-foreground hover:bg-primary/10 active:bg-primary/20 transition-colors select-none">
                  <Menu className="w-6 h-6" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 mt-2 ml-2">
                <DropdownMenuItem onClick={() => navigate('/studio')}><Mic className="w-4 h-4 mr-2" /> Studio</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/cover-art')}><Wand2 className="w-4 h-4 mr-2" /> AI Cover Art</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/playlists')}><Music className="w-4 h-4 mr-2" /> Playlists</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/files')}><FileText className="w-4 h-4 mr-2" /> Files</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/leaderboard')}><Trophy className="w-4 h-4 mr-2" /> Leaderboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}><Settings className="w-4 h-4 mr-2" /> Settings</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
            onClick={() => window.dispatchEvent(new Event('open-ai-assistant'))}
            className="relative p-1.5 ml-1 rounded-lg flex items-center justify-center text-white bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <AudioLines className="w-4 h-4 animate-pulse" />
          </button>
        </div>
      </div>
    </header>
  );
}