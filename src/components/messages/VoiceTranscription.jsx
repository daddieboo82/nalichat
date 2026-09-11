import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, FileText, Loader2, LockKeyhole, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { invokeAiFunction } from "@/lib/aiUsage";
import {
  createTranscriptionRequestKey,
  requestVoiceTranscription,
  transcriptionErrorDetails,
} from "@/lib/voiceTranscription";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

export default function VoiceTranscription({ message, isOwn }) {
  const {
    plan,
    hasEntitlement,
    isLoading: subscriptionLoading,
    isError: subscriptionError,
    refetch,
  } = useSubscription();
  const isEntitled = hasEntitlement("voice.transcription");
  const canRequest = isEntitled || subscriptionError;
  const [state, setState] = useState({ status: "idle", text: "", errorCode: null });
  const [error, setError] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const requestKeyRef = useRef(createTranscriptionRequestKey(message.id));
  const mountedRef = useRef(true);
  const audioRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    requestKeyRef.current = createTranscriptionRequestKey(message.id);
    setState({ status: "idle", text: "", errorCode: null });
    setError(null);
    setExpanded(false);
  }, [message.id]);

  const requestTranscript = useCallback(async ({ newAttempt = false } = {}) => {
    if (!message.id || !canRequest) return;
    if (newAttempt) {
      requestKeyRef.current = createTranscriptionRequestKey(message.id, crypto.randomUUID());
    }
    setState((current) => ({ ...current, status: "pending" }));
    setError(null);
    try {
      const next = await requestVoiceTranscription(message.id, requestKeyRef.current);
      if (!mountedRef.current) return;
      setState(next);
      if (next.status === "failed") {
        setError(transcriptionErrorDetails({ data: { code: next.errorCode } }));
      }
    } catch (requestError) {
      if (!mountedRef.current) return;
      setState((current) => ({ ...current, status: "failed" }));
      setError(transcriptionErrorDetails(requestError));
    }
  }, [canRequest, message.id]);

  useEffect(() => {
    if (state.status !== "pending") return undefined;
    const timer = setTimeout(() => requestTranscript(), 1500);
    return () => clearTimeout(timer);
  }, [requestTranscript, state.status]);

  const speak = async () => {
    if (!state.text) return;
    setSpeaking(true);
    try {
      const data = await invokeAiFunction("generate-speech", {
        text: state.text,
        voice: "honey",
      });
      if (!data?.url) throw new Error("Speech audio was not returned.");
      const audio = new Audio(data.url);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch (requestError) {
      toast.error(requestError?.message || "Unable to read the transcript aloud.");
      setSpeaking(false);
    }
  };

  const quietText = isOwn ? "text-white/70" : "text-muted-foreground";
  const actionText = isOwn ? "text-white" : "text-primary";

  if (subscriptionLoading) {
    return (
      <div className={cn("mt-1.5 flex items-center gap-1.5 px-1 text-[11px]", quietText)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking transcription access...
      </div>
    );
  }

  if (!isEntitled && !subscriptionError) {
    return (
      <div className={cn(
        "mt-1.5 rounded-lg border px-2.5 py-2 text-[11px]",
        isOwn ? "border-white/20 bg-white/10 text-white/85" : "border-border/50 bg-secondary/30",
      )}>
        <div className="flex items-start gap-1.5">
          <LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" />
          <p>
            {plan === "free"
              ? "Voice playback is free. Premium Plus adds on-demand transcription."
              : "Voice-note transcription is included with Premium Plus."}
          </p>
        </div>
        <div className="mt-1.5 flex gap-3 font-semibold">
          <Link to="/pricing" className="hover:underline">View Premium Plus</Link>
        </div>
      </div>
    );
  }

  if (state.status === "idle") {
    return (
      <div className={cn(
        "mt-1.5 rounded-lg border px-2.5 py-2 text-[11px]",
        isOwn ? "border-white/20 bg-white/10 text-white/85" : "border-border/50 bg-secondary/30",
      )}>
        <p>
          {subscriptionError && "Subscription status could not be loaded; the server will verify access. "}
          Transcription sends this audio to our AI provider. The saved transcript can be viewed
          by conversation participants who have Premium Plus.
        </p>
        {subscriptionError && (
          <button type="button" onClick={() => refetch()} className="mt-1 font-semibold hover:underline">
            Refresh subscription status
          </button>
        )}
        <button
          type="button"
          onClick={() => requestTranscript()}
          className={cn("mt-1.5 flex items-center gap-1 font-semibold hover:underline", actionText)}
        >
          <FileText className="h-3 w-3" />
          Transcribe voice note
        </button>
      </div>
    );
  }

  if (state.status === "pending") {
    return (
      <div className={cn("mt-1.5 flex items-center gap-1.5 px-1 text-[11px]", quietText)} aria-live="polite">
        <Loader2 className="h-3 w-3 animate-spin" />
        Transcription in progress...
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div className={cn(
        "mt-1.5 rounded-lg border px-2.5 py-2 text-[11px]",
        isOwn ? "border-white/20 bg-white/10 text-white/90" : "border-destructive/30 bg-destructive/5",
      )} role="alert">
        <div className="flex items-start gap-1.5">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <p>{error?.message || "Unable to transcribe this voice note."}</p>
        </div>
        <div className="mt-1.5 flex gap-3 font-semibold">
          {error?.retryable && (
            <button
              type="button"
              onClick={() => requestTranscript({ newAttempt: true })}
              className="hover:underline"
            >
              Try a new attempt
            </button>
          )}
          {error?.isQuotaExhausted && (
            <Link to="/pricing" className="hover:underline">View plans</Link>
          )}
        </div>
      </div>
    );
  }

  const preview = expanded ? state.text : state.text.slice(0, 120);
  const truncated = state.text.length > 120;
  return (
    <div className={cn(
      "mt-1.5 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug",
      isOwn
        ? "bg-white/10 text-white/90"
        : "border border-border/40 bg-secondary/40 text-foreground/80",
    )}>
      <div className="flex items-start gap-1.5">
        <FileText className={cn("mt-0.5 h-3 w-3 shrink-0", isOwn ? "text-white/50" : "text-primary/60")} />
        <p className="flex-1 whitespace-pre-wrap break-words">
          {preview}{truncated && !expanded && "..."}
        </p>
      </div>
      <div className="mt-1 flex items-center gap-2">
        {truncated && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className={cn("text-[10px] font-semibold hover:underline", actionText)}
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
        <button
          type="button"
          onClick={speak}
          disabled={speaking}
          className={cn(
            "flex items-center gap-1 text-[10px] font-semibold hover:underline disabled:opacity-50",
            actionText,
          )}
          title="Read aloud (sends transcript text to the speech provider)"
          aria-label="Read aloud"
        >
          <Volume2 className="h-3 w-3" />
          {speaking ? "Speaking..." : "Read aloud"}
        </button>
      </div>
    </div>
  );
}
