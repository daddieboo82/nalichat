import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Wand2, ChevronDown, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { base44 } from "@/api/base44Client";
import { renderMasteredMix } from "@/lib/autoMaster";

// Neutral params = straight mix with no EQ/loudness coloring (used when mastering is off)
const FLAT_PARAMS = {
  low_shelf: { freq_hz: 100, gain_db: 0 },
  low_mid: { freq_hz: 300, gain_db: 0, q: 1 },
  presence: { freq_hz: 3000, gain_db: 0, q: 1 },
  high_shelf: { freq_hz: 10000, gain_db: 0 },
  compressor: { threshold_db: 0, ratio: 1, attack_s: 0.01, release_s: 0.2, knee_db: 0 },
  makeup_gain_db: 0,
  limiter_ceiling_db: -1,
};

const STEPS = [
  "Analyzing your stacked stems...",
  "AI mastering engineer setting EQ, compression & loudness...",
  "Mixing & rendering industry-ready master...",
  "Publishing your finished song...",
];

export default function BounceDialog({ projectTitle, project, tracks, trigger, open: controlledOpen, onOpenChange, redirectAfter }) {
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  const [bounceTitle, setBounceTitle] = useState(`${projectTitle || "Untitled"}`);
  const [bouncing, setBouncing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [autoMaster, setAutoMaster] = useState(true);
  const [showManualParams, setShowManualParams] = useState(false);
  const [params, setParams] = useState(FLAT_PARAMS);
  const [savedParams, setSavedParams] = useState(null);

  const handleBounce = async () => {
    if (!bounceTitle.trim() || tracks.length === 0) return;
    setBouncing(true);
    setError("");
    setDone(false);
    setStep(0);

    try {
      const validTracks = tracks.filter(t => t.file_url && !t.muted);
      if (validTracks.length === 0) {
        setError("Stack at least one unmuted recorded sound or vocal to bounce.");
        setBouncing(false);
        return;
      }

      // 1. AI mastering engineer decides the processing chain (skip when disabled)
      setStep(1);
      let masterParams = params;
      if (autoMaster && !showManualParams) {
        const res = await base44.functions.invoke("aiMasterSession", {
          project_title: bounceTitle,
          genre: project?.genre,
          bpm: project?.bpm,
          stems: validTracks.map(t => ({ name: t.name, type: t.type })),
        });
        if (res.data?.error) throw new Error(res.data.error);
        masterParams = res.data;
        setParams(masterParams);
      }

      // Save params before bouncing
      setSavedParams(masterParams);

      // 2. Mix + apply the AI master in one render
      setStep(2);
      const wav = await renderMasteredMix(validTracks, masterParams);
      const blob = new Blob([wav], { type: "audio/wav" });

      // 3. Upload + publish the finished, industry-ready song
      setStep(3);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
      const me = await base44.auth.me();
      await base44.entities.ArtPost.create({
        title: bounceTitle,
        description: autoMaster
          ? `AI-mastered, industry-ready song produced from ${validTracks.length} stacked stems.`
          : `Song produced from ${validTracks.length} stacked stems.`,
        file_url,
        medium: "production",
        genre: project?.genre,
        bpm: project?.bpm,
        creator_id: me.id,
        creator_name: me.display_name || me.full_name,
        creator_avatar: me.avatar_url,
        featured: false,
        likes: 0,
        views: 0,
      });

      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setBouncing(false);
        setError("");
        setShowManualParams(false);
        if (redirectAfter === 'cover-art') {
          navigate('/cover-art');
        } else if (redirectAfter === 'explore') {
          navigate('/explore');
        }
      }, 1400);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to produce song";
      setError(errMsg);
      console.error("Bounce failed:", err);
      setBouncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!bouncing) setOpen(v); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ? trigger : (
            <Button className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              Bounce
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Export Studio Track
          </DialogTitle>
          <DialogDescription>
            {redirectAfter === 'cover-art' 
              ? "Bounce your track and head straight to the Cover Creator."
              : "Just stack your recorded sounds & vocals — AI mixes, masters, and publishes your industry-ready song."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Song name"
            value={bounceTitle}
            onChange={(e) => setBounceTitle(e.target.value)}
            disabled={bouncing}
            className="rounded-xl"
          />

          {!bouncing && !done && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                  <Wand2 className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">AI Auto-Mastering</p>
                  <p className="text-xs text-muted-foreground">Industry-standard EQ, compression & limiting for a pro-finished sound.</p>
                </div>
                <Switch checked={autoMaster} onCheckedChange={setAutoMaster} />
              </div>

              {autoMaster && (
                <button
                  onClick={() => setShowManualParams(!showManualParams)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
                >
                  <span>Manually adjust mastering</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showManualParams ? "rotate-180" : ""}`} />
                </button>
              )}

              {showManualParams && (
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/50 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Makeup Gain (dB)</label>
                    <Slider
                      min={-6}
                      max={6}
                      step={0.5}
                      value={[params.makeup_gain_db]}
                      onValueChange={([v]) => setParams({...params, makeup_gain_db: v})}
                      className="w-full"
                    />
                    <span className="text-xs text-muted-foreground">{params.makeup_gain_db.toFixed(1)} dB</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Limiter Ceiling (dB)</label>
                    <Slider
                      min={-12}
                      max={-0.1}
                      step={0.5}
                      value={[params.limiter_ceiling_db]}
                      onValueChange={([v]) => setParams({...params, limiter_ceiling_db: v})}
                      className="w-full"
                    />
                    <span className="text-xs text-muted-foreground">{params.limiter_ceiling_db.toFixed(1)} dB</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Presence Boost (dB)</label>
                    <Slider
                      min={-3}
                      max={3}
                      step={0.5}
                      value={[params.presence.gain_db]}
                      onValueChange={([v]) => setParams({...params, presence: {...params.presence, gain_db: v}})}
                      className="w-full"
                    />
                    <span className="text-xs text-muted-foreground">{params.presence.gain_db.toFixed(1)} dB</span>
                  </div>

                  {savedParams && (
                    <button
                      onClick={() => {
                        setParams(savedParams);
                        setShowManualParams(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore Last Bounce
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {bouncing && !done && (
            <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-2">
              {STEPS.map((rawLabel, i) => {
                const label = !autoMaster && i === 1 ? "Skipping mastering (off)..." : rawLabel;
                return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {i < step ? (
                    <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  ) : i === step ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                  )}
                  <span className={i <= step ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                </div>
                );
              })}
            </div>
          )}

          {done && (
            <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-center gap-2 text-accent text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {redirectAfter === 'cover-art' 
                  ? "Track bounced! Redirecting to Cover Creator..." 
                  : "Your industry-ready song is published! Find it in Explore."}
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!done && (
            <Button
              onClick={handleBounce}
              disabled={!bounceTitle.trim() || bouncing}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
            >
              {bouncing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {redirectAfter === 'cover-art' ? "Exporting..." : "Exporting & Publishing..."}</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> {redirectAfter === 'cover-art' ? "Export to Cover Creator" : "Export & Publish Track"}</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}