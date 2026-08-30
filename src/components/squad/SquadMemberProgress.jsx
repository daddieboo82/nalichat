import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GOAL_MESSAGES, GOAL_TASKS, memberGoalMet } from "@/lib/squadBonus";

export default function SquadMemberProgress({ name, isYou, progress, member }) {
  const messages = progress?.[`member_${member}_messages`] || 0;
  const tasks = progress?.[`member_${member}_tasks`] || 0;
  const goalMet = progress ? memberGoalMet(progress, member) : false;
  const msgPct = Math.min(100, Math.round((messages / GOAL_MESSAGES) * 100));
  const taskPct = Math.min(100, Math.round((tasks / GOAL_TASKS) * 100));

  return (
    <div className="rounded-2xl bg-secondary/40 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
            {(name || "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{name}{isYou ? " (You)" : ""}</p>
          <p className={`text-[10px] font-semibold ${goalMet ? "text-green-400" : "text-muted-foreground"}`}>
            {goalMet ? "Goal met ✓" : "Goal in progress"}
          </p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Messages</span>
          <span>{messages}/{GOAL_MESSAGES}</span>
        </div>
        <div className="h-1.5 bg-background rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all" style={{ width: `${msgPct}%` }} />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Tasks</span>
          <span>{tasks}/{GOAL_TASKS}</span>
        </div>
        <div className="h-1.5 bg-background rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent to-primary rounded-full transition-all" style={{ width: `${taskPct}%` }} />
        </div>
      </div>
    </div>
  );
}