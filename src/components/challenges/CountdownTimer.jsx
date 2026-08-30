import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export default function CountdownTimer({ targetDate, label = "Ends in" }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, new Date(targetDate).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate) return null;

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="w-4 h-4 text-primary shrink-0" />
      <span className="text-muted-foreground">{label}</span>
      {remaining <= 0 ? (
        <span className="font-heading font-bold text-destructive">Ended</span>
      ) : (
        <span className="font-heading font-bold text-foreground">
          {days > 0 && `${days}d `}{hours}h {minutes}m {seconds}s
        </span>
      )}
    </div>
  );
}