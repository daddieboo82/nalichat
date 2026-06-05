import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Music, ShoppingCart } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useCart } from "@/lib/CartContext";

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

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const path = location.pathname;
  const isSubPage = SUBPAGE_PREFIXES.some((p) => path.startsWith(p) && p !== "/");
  const title = TITLES[path] || Object.entries(TITLES).find(([k]) => k !== "/" && path.startsWith(k))?.[1] || "NaliChat";

  return (
    <header
      className="md:hidden sticky top-0 z-40 border-b border-border bg-card/70 backdrop-blur-md select-none"
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
            <Link to="/" className="ml-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <Music className="w-4 h-4 text-white" />
              </div>
            </Link>
          )}
          <h1 className="font-heading font-bold text-base truncate">{title}</h1>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1 shrink-0">
          {(!user || (user?.role !== "admin" && !ADMIN_EMAILS.includes(user?.email))) && (
            <Link
              to="/pricing"
              className="h-6 px-3 rounded-full bg-gradient-to-r from-primary to-accent text-white font-semibold text-[10px] items-center justify-center flex mr-0.5 shadow-sm"
            >
              {user ? "PRO" : "Pricing"}
            </Link>
          )}
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
          <Link to="/profile" className="p-1 rounded-lg hover:bg-primary/10 transition-all select-none">
            <Avatar className="w-7 h-7 border border-border">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
                {user?.display_name?.[0] || user?.full_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}