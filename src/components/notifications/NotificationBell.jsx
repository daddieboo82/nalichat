import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Bell, MessageCircle, FileText, Users, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { registerServiceWorker, requestPushPermission, subscribeToRemotePush, showPushNotification, getPermissionStatus } from "@/lib/pushNotifications";
import { sounds } from "@/hooks/use-sound";

const typeIcon = {
  comment: MessageCircle,
  file: FileText,
  session_invite: Users,
  milestone: CheckCircle2,
  message: MessageCircle,
};

export default function NotificationBell({ direction = "down" }) {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState(() => getPermissionStatus());
  const { toast } = useToast();
  const panelRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    // Register the service worker, but only request notification permission
    // from an explicit user gesture. Browsers may block permission prompts
    // triggered from timers or page load.
    registerServiceWorker().finally(() => {
      setPushPermission(getPermissionStatus());
    });
  }, []);

  const load = async (uid) => {
    const list = await base44.entities.Notification.filter({ recipient_id: uid }, "-created_date", 30);
    setItems(list);
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let previousIds = new Set();

    const refreshNotifications = async () => {
      try {
        const list = await base44.entities.Notification.filter({ recipient_id: user.id }, "-created_date", 30);
        if (cancelled) return;
        const nextIds = new Set((list || []).map((n) => n.id));

        if (previousIds.size > 0) {
          const newest = (list || []).find((n) => !previousIds.has(n.id));
          if (newest) {
            sounds.notification();
            toast({ title: newest.actor_name || "New activity", description: newest.message });
            showPushNotification({
              title: newest.actor_name || "NaliChat",
              body: newest.message || "You have a new notification",
              url: newest.link || "/",
            });
          }
        }

        previousIds = nextIds;
        setItems(list || []);
      } catch {
        // Notifications are non-critical; retry on the next poll.
      }
    };

    refreshNotifications();
    const poll = window.setInterval(refreshNotifications, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
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

  const enableNotifications = async () => {
    await registerServiceWorker();
    const granted = await requestPushPermission();
    setPushPermission(getPermissionStatus());
    if (granted) {
      try {
        await subscribeToRemotePush();
      } catch (error) {
        console.error('Remote push registration failed:', error);
      }
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        className="relative w-11 h-11 lg:w-10 lg:h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all"
        title="Notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
      >
          <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(
          "absolute right-0 w-80 max-w-[90vw] bg-card border border-border rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden",
          direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
        )}>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <p className="font-heading font-bold text-sm">Notifications</p>
            {pushPermission === 'default' && (
              <button
                type="button"
                onClick={enableNotifications}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Enable alerts
              </button>
            )}
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