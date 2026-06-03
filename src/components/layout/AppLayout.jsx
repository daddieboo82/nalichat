import { Outlet, Link, useLocation } from "react-router-dom";
import { MessageSquare, Users, Settings, LogOut, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Users, label: "Contacts", path: "/network" },
];

export default function AppLayout() {
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[72px] bg-card border-r border-border flex flex-col items-center py-6 gap-2 shrink-0">
        <Link to="/" className="mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
        </Link>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="absolute left-16 bg-card border border-border text-foreground text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 font-medium">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 items-center">
          <Link
            to="/settings"
            className="w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <Settings className="w-5 h-5" />
          </Link>
          <button
            onClick={() => base44.auth.logout()}
            className="w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <Link to="/settings">
            <Avatar className="w-9 h-9 border-2 border-border hover:border-primary transition-colors cursor-pointer">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                {user?.full_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}