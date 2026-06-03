import { Link, useLocation } from "react-router-dom";
import { Home, Compass, Mic, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Mic, label: "Studio", path: "/studio" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: User, label: "Profile", path: "/profile" },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const isActive = (tabPath) =>
    tabPath === "/" ? path === "/" : path.startsWith(tabPath);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/90 backdrop-blur-md select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around">
        {tabs.map(({ icon: Icon, label, path: tabPath }) => {
          const active = isActive(tabPath);
          return (
            <Link
              key={tabPath}
              to={tabPath}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 select-none transition-colors active:bg-primary/10",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", active && "scale-110 transition-transform")} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}