import React, { useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, PlayCircle, X, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const STUDIO_TUTORIALS = [
  {
    id: "overview",
    title: "Studio Quick Tour",
    description: "See the real NaliStudio layout, tracks, transport, tools, and session controls.",
    video: "/tutorials/studio-overview.webm",
    steps: ["Load or create a session", "Use the transport at the top", "Choose editing tools and track controls"],
  },
  {
    id: "edit",
    title: "Play & Edit Clips",
    description: "See playback and the editing-tool workflow on a real two-track Studio session.",
    video: "/tutorials/studio-play-edit.webm",
    steps: ["Press Play/Pause", "Choose Trim, Cut, Grabber, Fade, or Smart", "Work directly on the waveform lane"],
  },
  {
    id: "add-track",
    title: "Add a Track",
    description: "Open the real Add Track workflow when you need another vocal, audio, instrument, VCA, or folder track.",
    video: "/tutorials/studio-add-track.webm",
    steps: ["Click Add Track", "Choose the track type", "Name and configure the new track"],
  },
  {
    id: "recording",
    title: "Record a Track",
    description: "Arm a real Studio track, use the transport Record button, and stop the take when you are done.",
    video: "/tutorials/studio-recording.webm",
    steps: ["Choose a microphone/input", "Arm the track with the red-circle track control", "Press Record in the transport, then Stop when the take is finished"],
  },
  {
    id: "mixer",
    title: "Mixer & Levels",
    description: "Open the real Mixer to control volume, pan, sends, mute/solo, FX, and the master bus.",
    video: "/tutorials/studio-mixer.webm",
    steps: ["Open Mixer", "Adjust each track strip", "Use FX and the master output to shape the mix"],
  },
  {
    id: "plugins",
    title: "Plugins & FX",
    description: "Open the real Plugins rack to work with track and master effects without leaving the Studio session.",
    video: "/tutorials/studio-plugins.webm",
    steps: ["Select the track you want to process", "Open Plugins", "Choose or adjust the track/master FX chain"],
  },
  {
    id: "export",
    title: "Export Your Song",
    description: "See the real export flow used to bounce your finished NaliStudio session.",
    video: "/tutorials/studio-export.webm",
    steps: ["Click Export", "Choose the available export option", "Confirm the bounce/export settings"],
  },
];

export function openStudioVideoHelp(topic = "overview") {
  window.dispatchEvent(new CustomEvent("studio-video-help", { detail: { topic } }));
}

export default function StudioVideoHelp() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("overview");
  const [showIdleHint, setShowIdleHint] = useState(false);
  const idleTimerRef = useRef(null);

  const active = useMemo(
    () => STUDIO_TUTORIALS.find((item) => item.id === topic) || STUDIO_TUTORIALS[0],
    [topic],
  );

  useEffect(() => {
    const openForTopic = (event) => {
      const requested = event.detail?.topic;
      if (STUDIO_TUTORIALS.some((item) => item.id === requested)) setTopic(requested);
      setShowIdleHint(false);
      setOpen(true);
    };
    window.addEventListener("studio-video-help", openForTopic);
    return () => window.removeEventListener("studio-video-help", openForTopic);
  }, []);

  useEffect(() => {
    const resetIdle = () => {
      setShowIdleHint(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (!open) setShowIdleHint(true);
      }, 45000);
    };

    const events = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdle));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [open]);

  const choose = (id) => {
    setTopic(id);
    setOpen(true);
    setShowIdleHint(false);
  };

  return (
    <>
      {showIdleHint && !open && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[145] rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-2xl backdrop-blur-xl sm:bottom-16 sm:left-auto sm:right-4 sm:max-w-xs">
          <button
            aria-label="Dismiss Studio help suggestion"
            onClick={() => setShowIdleHint(false)}
            className="ui-hover absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex gap-3 pr-5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Stuck in Studio?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Watch a short real-app tutorial without leaving your session.</p>
              <button
                className="ui-hover mt-2 min-h-9 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={() => choose("overview")}
              >
                Show me how
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Studio video tutorials"
        className="ui-hover fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[140] flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-card/95 px-3.5 py-2.5 text-sm font-semibold shadow-xl backdrop-blur-xl transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40 lg:bottom-4 lg:right-4"
      >
        <CircleHelp className="w-4 h-4 text-primary" />
        <span className="hidden sm:inline">Video Help</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/65 p-2 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Studio video tutorials">
          <div className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl sm:max-h-[92dvh]">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="font-heading font-bold text-lg">Studio Video Help</p>
                <p className="text-xs text-muted-foreground">Real NaliStudio footage — choose what you are trying to do.</p>
              </div>
              <Button className="ui-hover h-11 w-11 rounded-xl" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close Studio video tutorials">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid md:grid-cols-[250px_minmax(0,1fr)] min-h-0 flex-1 overflow-hidden">
              <div className="border-b md:border-b-0 md:border-r border-border p-3 overflow-x-auto md:overflow-y-auto">
                <div className="flex md:flex-col gap-2 min-w-max md:min-w-0">
                  {STUDIO_TUTORIALS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setTopic(item.id)}
                      className={cn(
                        "ui-hover min-h-[68px] w-52 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 md:w-full",
                        item.id === active.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-border/60 bg-secondary/20 hover:bg-secondary/50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <PlayCircle className={cn("w-4 h-4", item.id === active.id ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-sm font-semibold">{item.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black aspect-video shadow-xl">
                  <video
                    key={active.video}
                    src={active.video}
                    controls
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                </div>
                <h3 className="font-heading font-bold text-xl mt-4">{active.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{active.description}</p>
                <div className="mt-4 rounded-xl bg-secondary/30 border border-border/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Do this</p>
                  <ol className="space-y-2">
                    {active.steps.map((step, index) => (
                      <li key={step} className="flex gap-2 text-sm">
                        <span className="w-5 h-5 shrink-0 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center">{index + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="ui-hover mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to my Studio session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
