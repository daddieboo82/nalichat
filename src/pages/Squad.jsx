import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Copy, Check, Sparkles, LogOut } from "lucide-react";
import { toast } from "sonner";
import SquadMemberProgress from "@/components/squad/SquadMemberProgress";
import { getSquadBonusStatus, generateInviteCode, BONUS_MULTIPLIER, CREDITS_REWARD } from "@/lib/squadBonus";

export default function Squad() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [squad, setSquad] = useState(null);
  const [progress, setProgress] = useState(null);
  const [bonusActive, setBonusActive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [credits, setCredits] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [asA, asB] = await Promise.all([
      base44.entities.Squad.filter({ member_a_id: user.id }),
      base44.entities.Squad.filter({ member_b_id: user.id }),
    ]);
    const mine = [...asA, ...asB]
      .filter((s) => s.status !== "ended")
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0] || null;
    setSquad(mine);

    if (mine && mine.status === "active") {
      const status = await getSquadBonusStatus(user);
      setProgress(status.progress);
      setBonusActive(status.active);
      const fresh = await base44.auth.me();
      setCredits(fresh.squad_credits || 0);
    } else {
      setCredits(user.squad_credits || 0);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const inviteLink = squad ? `${window.location.origin}/squad/join/${squad.invite_code}` : "";

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const created = await base44.entities.Squad.create({
        member_a_id: user.id,
        member_a_name: user.full_name || user.email,
        invite_code: generateInviteCode(),
        status: "pending",
      });
      setSquad(created);
      toast.success("Squad invite created! Share your link.");
    } catch (err) {
      toast.error("Couldn't create a squad invite.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    if (!squad) return;
    try {
      await base44.entities.Squad.update(squad.id, { status: "ended" });
      setSquad(null);
      setProgress(null);
      setBonusActive(false);
      toast.success(squad.status === "pending" ? "Invite cancelled." : "You left the squad.");
    } catch {
      toast.error("Couldn't update the squad.");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const isMemberA = squad?.member_a_id === user?.id;
  const youName = user?.full_name || user?.email;
  const partnerName = isMemberA ? squad?.member_b_name : squad?.member_a_name;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gradient-animate">Squad & Scale</h1>
        <p className="text-muted-foreground text-sm mt-1">Link up with a partner — hit your weekly goals together and unlock a 1.5x weekend bonus.</p>
      </div>

      {/* Credits */}
      <div className="flex items-center justify-between rounded-2xl bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="w-4 h-4 text-primary" /> Squad Credits
        </div>
        <span className="font-heading font-bold text-lg text-primary">{credits}</span>
      </div>

      {!squad && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-4">
          <Users className="w-10 h-10 mx-auto text-primary/60" />
          <div>
            <h2 className="font-heading font-bold text-lg">Form a Squad</h2>
            <p className="text-sm text-muted-foreground mt-1">Invite a friend to team up. Both of you hitting your weekly chat or task goals unlocks a {BONUS_MULTIPLIER}x weekend bonus and {CREDITS_REWARD} squad credits each.</p>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="rounded-full bg-gradient-to-r from-primary to-accent text-white">
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
            Create Squad Invite
          </Button>
        </div>
      )}

      {squad && squad.status === "pending" && (
        <div className="rounded-2xl bg-secondary/40 p-6 space-y-4">
          <h2 className="font-heading font-bold text-lg">Waiting for your partner</h2>
          <p className="text-sm text-muted-foreground">Share this link — as soon as they join, your squad goes active.</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate bg-background rounded-xl px-3 py-2 text-xs text-muted-foreground">{inviteLink}</div>
            <Button size="icon" variant="outline" onClick={handleCopy} className="rounded-xl shrink-0" aria-label="Copy invite link">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button variant="ghost" onClick={handleLeave} className="text-muted-foreground hover:text-destructive gap-1.5 px-0">
            <LogOut className="w-4 h-4" /> Cancel invite
          </Button>
        </div>
      )}

      {squad && squad.status === "active" && (
        <div className="space-y-4">
          {bonusActive ? (
            <div className="rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 p-4 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary shrink-0" />
              <p className="text-sm font-semibold">🔥 {BONUS_MULTIPLIER}x weekend bonus is active for you and {partnerName || "your partner"}!</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-secondary/40 p-4">
              <p className="text-sm text-muted-foreground">Both of you need to hit your weekly goal (20 messages or 3 tasks) to unlock this weekend's {BONUS_MULTIPLIER}x bonus.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SquadMemberProgress name={youName} isYou member={isMemberA ? "a" : "b"} progress={progress} />
            <SquadMemberProgress name={partnerName || "Your partner"} member={isMemberA ? "b" : "a"} progress={progress} />
          </div>

          <Button variant="ghost" onClick={handleLeave} className="text-muted-foreground hover:text-destructive gap-1.5 px-0">
            <LogOut className="w-4 h-4" /> Leave squad
          </Button>
        </div>
      )}
    </div>
  );
}