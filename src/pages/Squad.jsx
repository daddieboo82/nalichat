import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Copy, Check, Sparkles, LogOut } from "lucide-react";
import { toast } from "sonner";
import SquadMemberProgress from "@/components/squad/SquadMemberProgress";
import { getSquadBonusStatus, BONUS_MULTIPLIER, CREDITS_REWARD } from "@/lib/squadBonus";
import PullToRefresh from "@/components/layout/PullToRefresh";
import LoadError from "@/components/layout/LoadError";
import { copyToClipboard } from "@/lib/clipboard";

async function listAllSquads(query) {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.Squad.filter(
      query,
      "-created_date",
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function Squad() {
  const { user, checkUserAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [squad, setSquad] = useState(null);
  const [stateOwnerId, setStateOwnerId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [bonusActive, setBonusActive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);
  const loadGenerationRef = useRef(0);
  const [credits, setCredits] = useState(0);

  const load = useCallback(async () => {
    if (!user?.id) {
      setStateOwnerId(null);
      setSquad(null);
      setProgress(null);
      setBonusActive(false);
      setCredits(0);
      setCopied(false);
      setLoading(false);
      return;
    }
    const requestedUserId = user.id;
    const generation = ++loadGenerationRef.current;
    const isStale = () => generation !== loadGenerationRef.current;
    setLoading(true);
    setStateOwnerId(requestedUserId);
    setSquad(null);
    setProgress(null);
    setBonusActive(false);
    setCredits(0);
    setCopied(false);
    // Any rejection below used to skip setLoading(false), leaving a permanent spinner.
    setLoadError(false);
    try {
      const [asA, asB] = await Promise.all([
        listAllSquads({ member_a_id: requestedUserId }),
        listAllSquads({ member_b_id: requestedUserId }),
      ]);
      if (isStale()) return;
      const mine = [...asA, ...asB]
        .filter((s) => s.status !== "ended")
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0] || null;
      setSquad(mine);

      if (mine && mine.status === "active") {
        const status = await getSquadBonusStatus(requestedUserId);
        if (isStale()) return;
        setProgress(status.progress);
        setBonusActive(status.active);
        const fresh = await checkUserAuth();
        if (isStale()) return;
        if (!fresh?.id || fresh.id !== requestedUserId) {
          throw new Error("Squad account refresh was not confirmed.");
        }
        setCredits(fresh.squad_credits || 0);
      } else {
        setCredits(user.squad_credits || 0);
      }
    } catch (e) {
      if (!isStale()) {
        console.error("Failed to load squad", e);
        setLoadError(true);
      }
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [user, checkUserAuth]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const inviteLink = squad ? `${window.location.origin}/squad/join/${squad.invite_code}` : "";

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const res = await base44.functions.invoke("createSquadInvite", {});
      if (res?.data?.error) throw new Error(res.data.error);
      const createdSquad = res?.data?.squad;
      if (res?.data?.success !== true || !createdSquad?.id || !createdSquad?.invite_code) {
        throw new Error("Squad invite creation was not confirmed");
      }
      setSquad(createdSquad);
      toast.success("Squad invite created! Share your link.");
    } catch (err) {
      toast.error("Couldn't create a squad invite.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    const copiedSuccessfully = await copyToClipboard(inviteLink);
    if (!copiedSuccessfully) {
      toast.error("Couldn't copy the squad invite. Please copy it manually.");
      return;
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      copyTimerRef.current = null;
      setCopied(false);
    }, 2000);
  };

  const handleLeave = async () => {
    if (!squad) return;
    try {
      const res = await base44.functions.invoke("leaveSquad", { squadId: squad.id });
      if (res?.data?.error) throw new Error(res.data.error);
      if (res?.data?.success !== true) throw new Error("Squad update was not confirmed");
      setSquad(null);
      setProgress(null);
      setBonusActive(false);
      toast.success(squad.status === "pending" ? "Invite cancelled." : "You left the squad.");
    } catch {
      toast.error("Couldn't update the squad.");
    }
  };

  if (user?.id && stateOwnerId !== user.id) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (loadError) {
    return (
      <LoadError
        title="Couldn't load your squad"
        message="We couldn't reach the server. Check your connection and try again."
        onRetry={load}
      />
    );
  }

  const isMemberA = squad?.member_a_id === user?.id;
  const youName = user?.full_name || user?.email;
  const partnerName = isMemberA ? squad?.member_b_name : squad?.member_a_name;

  return (
    <PullToRefresh onRefresh={load} className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
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
    </PullToRefresh>
  );
}