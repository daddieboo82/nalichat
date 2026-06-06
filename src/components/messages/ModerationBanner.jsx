import { useState, useEffect } from "react";
import { ShieldAlert, Ban } from "lucide-react";

function formatRemaining(until) {
  const ms = new Date(until) - new Date();
  if (ms <= 0) return null;
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24) return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export default function ModerationBanner({ currentUser }) {
  const [remaining, setRemaining] = useState(() => formatRemaining(currentUser?.timeout_until));
  const banned = currentUser?.is_banned;

  useEffect(() => {
    if (banned || !currentUser?.timeout_until) return;
    const id = setInterval(() => setRemaining(formatRemaining(currentUser.timeout_until)), 30000);
    return () => clearInterval(id);
  }, [currentUser?.timeout_until, banned]);

  return (
    <div className="pointer-events-auto w-full max-w-4xl mx-auto rounded-3xl bg-destructive/10 border border-destructive/30 backdrop-blur-2xl px-5 py-4 flex items-center gap-3 shadow-2xl">
      <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
        {banned ? <Ban className="w-5 h-5 text-destructive" /> : <ShieldAlert className="w-5 h-5 text-destructive" />}
      </div>
      <div className="min-w-0">
        <p className="font-heading font-semibold text-sm text-destructive">
          {banned ? "Account banned" : "You're timed out (48 hours)"}
        </p>
        <p className="text-[12px] text-muted-foreground leading-snug">
          {banned
            ? "Your account has been banned for repeated policy violations. You can only message an admin to appeal."
            : `Messaging is paused for a content policy violation${remaining ? `. Try again in ${remaining}.` : "."}`}
        </p>
      </div>
    </div>
  );
}