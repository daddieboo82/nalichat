import { useState, useEffect } from "react";
import { Loader2, FileText, Volume2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

/**
 * Fetches and displays an AI transcription of a voice message.
 * Caches results per message id to avoid re-transcribing on re-render.
 * Also provides a "Read aloud" button to play the transcription via TTS.
 */
const transcriptionCache = new Map();
const ttsCache = new Map();

export default function VoiceTranscription({ message, isOwn }) {
  const [transcription, setTranscription] = useState(
    transcriptionCache.get(message.id) || null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useState(null);

  useEffect(() => {
    if (transcription || loading || error) return;
    if (!message.file_url || !message.id) return;

    let cancelled = false;
    setLoading(true);

    base44.functions.invoke("transcribeMessageAudio", { messageId: message.id })
      .then((res) => {
        if (cancelled) return;
        if (res?.data?.error) throw new Error(res.data.error);
        const text = res?.data?.text || "";
        const clean = typeof text === "string" ? text.trim() : String(text).trim();
        if (clean && clean.length > 0) {
          transcriptionCache.set(message.id, clean);
          setTranscription(clean);
        } else {
          setError(true);
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [message.id, message.file_url]);

  const speak = async () => {
    if (!transcription) return;
    setSpeaking(true);
    try {
      const res = await base44.functions.invoke("generate-speech", {
        text: transcription,
        voice: "honey",
      });
      const url = res?.data?.url;
      if (!url) return;
      const audio = new Audio(url);
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch {
      setSpeaking(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center gap-1.5 text-[11px] mt-1.5 px-1", isOwn ? "text-white/60" : "text-muted-foreground")}>
        <Loader2 className="w-3 h-3 animate-spin" />
        Transcribing…
      </div>
    );
  }

  if (error || !transcription) return null;

  const preview = expanded ? transcription : transcription.slice(0, 120);
  const truncated = transcription.length > 120;

  return (
    <div className={cn("mt-1.5 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug", isOwn ? "bg-white/10 text-white/90" : "bg-secondary/40 text-foreground/80 border border-border/40")}>
      <div className="flex items-start gap-1.5">
        <FileText className={cn("w-3 h-3 mt-0.5 shrink-0", isOwn ? "text-white/50" : "text-primary/60")} />
        <p className="flex-1 break-words whitespace-pre-wrap">{preview}{truncated && !expanded && "…"}</p>
      </div>
      <div className="flex items-center gap-2 mt-1">
        {truncated && (
          <button onClick={() => setExpanded(v => !v)} className={cn("text-[10px] font-semibold hover:underline", isOwn ? "text-white/70" : "text-primary")}>
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
        <button onClick={speak} disabled={speaking} className={cn("text-[10px] font-semibold flex items-center gap-1 hover:underline disabled:opacity-50", isOwn ? "text-white/70" : "text-primary")} title="Read aloud" aria-label="Read aloud">
          <Volume2 className="w-3 h-3" />
          {speaking ? "Speaking…" : "Read aloud"}
        </button>
      </div>
    </div>
  );
}