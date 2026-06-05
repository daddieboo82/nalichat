import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Bell, MessageCircle, FileText, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { registerServiceWorker, requestPushPermission, showPushNotification, getPermissionStatus } from "@/lib/pushNotifications";

const typeIcon = {
  comment: MessageCircle,
  file: FileText,
  session_invite: Users,
};

export default function NotificationBell({ direction = "down" }) {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const panelRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then((u) => { setUser(u); userRef.current = u; }).catch(() => {});
    // Register service worker and request push permission on first load
    registerServiceWorker().then(() => {
      if (getPermissionStatus() === 'default') {
        // Ask after a short delay so it doesn't immediately pop on page load
        setTimeout(() => requestPushPermission(), 3000);
      }
    });
  }, []);

  const load = async (uid) => {
    const list = await base44.entities.Notification.filter({ recipient_id: uid }, "-created_date", 30);
    setItems(list);
  };

  useEffect(() => {
    if (!user?.id) return;
    load(user.id);
    const unsub = base44.entities.Notification.subscribe((event) => {
      const me = userRef.current;
      if (!me) return;
      if (event.data?.recipient_id !== me.id) return;
      if (event.type === "create") {
        toast({ title: event.data.actor_name || "New activity", description: event.data.message });
        showPushNotification({
          title: event.data.actor_name || "NaliChat",
          body: event.data.message || "You have a new notification",
          url: event.data.link || "/",
        });
      }
      load(me.id);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const unreadItems = items.filter((n) => !n.read);
    await Promise.all(unreadItems.map((n) => base44.entities.Notification.update(n.id, { read: true })));
    if (user) load(user.id);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0 && user) markAllRead();
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(
          "absolute right-0 w-80 max-w-[90vw] bg-card border border-border rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden",
          direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
        )}>
          <div className="px-4 py-3 border-b border-border">
            <p className="font-heading font-bold text-sm">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              items.map((n) => {
                const Icon = typeIcon[n.type] || Bell;
                const inner = (
                  <div className={cn(
                    "flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/50",
                    !n.read && "bg-primary/5"
                  )}>
                    <div className="relative shrink-0">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={n.actor_avatar} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">{n.actor_name?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-card flex items-center justify-center">
                        <Icon className="w-2.5 h-2.5 text-primary" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{n.actor_name}</span>{" "}
                        <span className="text-muted-foreground">{n.message}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {n.created_date && !isNaN(new Date(n.created_date).getTime()) ? formatDistanceToNow(new Date(n.created_date), { addSuffix: true }) : "just now"}
                      </p>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} to={n.link} onClick={() => setOpen(false)}>{inner}</Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}