import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2, RefreshCw, ImageIcon, AlertCircle, LockKeyhole } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  createTranscriptionRequestKey,
  requestVoiceTranscription,
  transcriptionErrorDetails,
} from "@/lib/voiceTranscription";
import { useSubscription } from "@/hooks/useSubscription";
import { Link } from "react-router-dom";

const APP_URL = "nalichat.base44.app";
const CARD_SIZE = 1080;

// Wrap text to a max character width for canvas rendering.
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export default function VoiceCardDialog({ message, isOpen, onClose }) {
  const {
    plan,
    hasEntitlement,
    isLoading: subscriptionLoading,
    isError: subscriptionError,
    refetch,
  } = useSubscription();
  const isEntitled = hasEntitlement("voice.transcription");
  const canRequest = isEntitled || subscriptionError;
  const canvasRef = useRef(null);
  const [transcription, setTranscription] = useState(null);
  const [loadingTx, setLoadingTx] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [cardUrl, setCardUrl] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [consented, setConsented] = useState(false);
  const [pollVersion, setPollVersion] = useState(0);
  const requestKeyRef = useRef(createTranscriptionRequestKey(message?.id || "unknown"));

  const reset = () => {
    setTranscription(null);
    setLoadingTx(false);
    setRendering(false);
    setCardUrl(null);
    setError(null);
    setErrorDetails(null);
    setConsented(false);
    setPollVersion(0);
    requestKeyRef.current = createTranscriptionRequestKey(message?.id || "unknown");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Transcription starts only after the user accepts the processing disclosure.
  useEffect(() => {
    if (!isOpen || !consented || !canRequest || !message?.id) return;
    if (transcription !== null) return;
    let cancelled = false;
    setLoadingTx(true);
    setError(null);
    setErrorDetails(null);
    requestVoiceTranscription(message.id, requestKeyRef.current)
      .then((next) => {
        if (cancelled) return;
        if (next.status === "completed") {
          setTranscription(next.text);
          return;
        }
        if (next.status === "pending") {
          setTimeout(() => {
            if (!cancelled) setPollVersion((version) => version + 1);
          }, 1500);
          return;
        }
        if (next.status === "failed") {
          const details = transcriptionErrorDetails({ data: { code: next.errorCode } });
          setError(details.message);
          setErrorDetails(details);
        }
      })
      .catch((requestError) => {
        if (cancelled) return;
        const details = transcriptionErrorDetails(requestError);
        setError(details.message);
        setErrorDetails(details);
      })
      .finally(() => {
        if (!cancelled) setLoadingTx(false);
      });
    return () => { cancelled = true; };
  }, [canRequest, consented, isOpen, message?.id, pollVersion, transcription]);

  // Render the branded card onto the canvas
  const renderCard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRendering(true);
    try {
      const ctx = canvas.getContext("2d");
      canvas.width = CARD_SIZE;
      canvas.height = CARD_SIZE;

      // Background — NaliChat gradient
      const bgGrad = ctx.createLinearGradient(0, 0, CARD_SIZE, CARD_SIZE);
      bgGrad.addColorStop(0, "#1a1033");
      bgGrad.addColorStop(0.5, "#2d1b69");
      bgGrad.addColorStop(1, "#0d1b2a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

      // Ambient blobs
      ctx.globalAlpha = 0.18;
      const blob1 = ctx.createRadialGradient(180, 200, 0, 180, 200, 400);
      blob1.addColorStop(0, "#7c3aed");
      blob1.addColorStop(1, "transparent");
      ctx.fillStyle = blob1;
      ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

      const blob2 = ctx.createRadialGradient(900, 880, 0, 900, 880, 450);
      blob2.addColorStop(0, "#14b8a6");
      blob2.addColorStop(1, "transparent");
      ctx.fillStyle = blob2;
      ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
      ctx.globalAlpha = 1;

      // Header — avatar + name
      const headerY = 90;
      // Avatar circle
      let avatarDrawn = false;
      if (message?.sender_avatar) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = message.sender_avatar;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            setTimeout(reject, 4000);
          });
          ctx.save();
          ctx.beginPath();
          ctx.arc(120, headerY, 56, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, 64, headerY - 56, 112, 112);
          ctx.restore();
          avatarDrawn = true;
        } catch {}
      }
      if (!avatarDrawn) {
        const grad = ctx.createLinearGradient(64, headerY - 56, 176, headerY + 56);
        grad.addColorStop(0, "#7c3aed");
        grad.addColorStop(1, "#ec4899");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(120, headerY, 56, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 48px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((message?.sender_name || "?")[0]?.toUpperCase() || "?", 120, headerY);
      }
      // Avatar ring
      ctx.strokeStyle = "rgba(124, 58, 237, 0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(120, headerY, 58, 0, Math.PI * 2);
      ctx.stroke();

      // Sender name
      ctx.fillStyle = "#fff";
      ctx.font = "bold 44px 'Space Grotesk', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const senderName = message?.sender_name || "Unknown";
      ctx.fillText(senderName, 210, headerY - 12);

      // Subtitle
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "500 26px 'Inter', sans-serif";
      const duration = message?.duration ? `${Math.round(message.duration)}s voice note` : "voice note";
      ctx.fillText(duration, 210, headerY + 22);

      // Waveform section
      const waveY = 300;
      const waveW = CARD_SIZE - 160;
      const waveH = 180;
      const barCount = 64;
      const barWidth = waveW / barCount;
      const barGap = 6;
      for (let i = 0; i < barCount; i++) {
        const seed = Math.sin(i * 0.5 + (message?.id?.charCodeAt(0) || 0)) * 10000;
        const ratio = (Math.sin(seed) * 0.5 + 0.5) * 0.85 + 0.15;
        const barH = waveH * ratio;
        const x = 80 + i * barWidth + barGap / 2;
        const y = waveY + (waveH - barH) / 2;
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, "#7c3aed");
        grad.addColorStop(1, "#14b8a6");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth - barGap, barH, 6);
        ctx.fill();
      }

      // Transcription block
      const txY = 540;
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "600 40px 'Inter', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const maxTextWidth = CARD_SIZE - 160;
      const text = transcription || "(No transcription available)";
      const lines = wrapText(ctx, text, maxTextWidth);
      const maxLines = 5;
      const visibleLines = lines.slice(0, maxLines);
      if (lines.length > maxLines) {
        let last = visibleLines[maxLines - 1];
        while (ctx.measureText(last + "…").width > maxTextWidth && last.length > 0) {
          last = last.slice(0, -1);
        }
        visibleLines[maxLines - 1] = last + "…";
      }
      visibleLines.forEach((line, i) => {
        ctx.fillText(line, 80, txY + i * 52);
      });

      // Quote mark decoration
      ctx.fillStyle = "rgba(124, 58, 237, 0.25)";
      ctx.font = "bold 160px 'Space Grotesk', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("\u201C", 60, txY - 70);

      // Watermark footer
      const footerY = CARD_SIZE - 120;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, footerY, CARD_SIZE, 120);
      // Sparkle dot
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.arc(80, footerY + 60, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14b8a6";
      ctx.beginPath();
      ctx.arc(100, footerY + 60, 6, 0, Math.PI * 2);
      ctx.fill();
      // Brand text
      ctx.fillStyle = "#fff";
      ctx.font = "bold 36px 'Space Grotesk', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("NaliChat", 130, footerY + 52);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "500 24px 'Inter', sans-serif";
      ctx.fillText("Made in NaliChat", 130, footerY + 84);
      // URL on right
      ctx.fillStyle = "rgba(20, 184, 166, 0.9)";
      ctx.font = "600 28px 'Inter', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(APP_URL, CARD_SIZE - 80, footerY + 60);

      // Export to data URL for preview + download
      const dataUrl = canvas.toDataURL("image/png");
      setCardUrl(dataUrl);
    } catch (e) {
      console.error("Voice card render error", e);
      setError("Couldn't render the card. Try again!");
    } finally {
      setRendering(false);
    }
  }, [message, transcription]);

  // Auto-render once transcription is ready
  useEffect(() => {
    if (isOpen && transcription !== null && !cardUrl && !rendering) {
      renderCard();
    }
  }, [isOpen, transcription, cardUrl, rendering, renderCard]);

  const handleDownload = () => {
    if (!cardUrl) return;
    const a = document.createElement("a");
    a.href = cardUrl;
    a.download = `nalichat-voice-${message?.sender_name || "card"}.png`;
    a.click();
    toast.success("Voice card downloaded!");
  };

  const handleShare = async () => {
    if (!cardUrl) return;
    try {
      const res = await fetch(cardUrl);
      const blob = await res.blob();
      const file = new File([blob], "nalichat-voice-card.png", { type: "image/png" });
      const shareText = `Voice note from ${message?.sender_name || "NaliChat"} — transcribed & shared via NaliChat`;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
      } else if (navigator.share) {
        await navigator.share({ text: shareText });
      } else {
        handleDownload();
      }
    } catch {}
  };

  const handleRetry = () => {
    requestKeyRef.current = createTranscriptionRequestKey(message?.id, crypto.randomUUID());
    setTranscription(null);
    setLoadingTx(false);
    setRendering(false);
    setCardUrl(null);
    setError(null);
    setErrorDetails(null);
    setPollVersion((version) => version + 1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md sm:max-w-lg bg-card border-border/60 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-heading">
            <ImageIcon className="w-5 h-5 text-primary" />
            Shareable Voice Card
          </DialogTitle>
          <DialogDescription className="text-xs">
            A branded card with the transcript, waveform, and a NaliChat watermark — ready for TikTok, Instagram, or X.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5">
          <AnimatePresence mode="wait">
            {subscriptionLoading && (
              <motion.div key="checking-access" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking transcription access...
              </motion.div>
            )}

            {!subscriptionLoading && !isEntitled && !subscriptionError && (
              <motion.div key="upgrade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <LockKeyhole className="h-8 w-8 text-primary" />
                <p className="text-sm">
                  {plan === "free"
                    ? "Voice playback is free. Premium Plus adds transcription and voice cards."
                    : "Voice-note transcription and voice cards require Premium Plus."}
                </p>
                <Button asChild size="sm"><Link to="/pricing">View Premium Plus</Link></Button>
              </motion.div>
            )}

            {!subscriptionLoading && canRequest && !consented && (
              <motion.div key="consent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 py-6">
                <p className="text-sm text-muted-foreground">
                  {subscriptionError && "Subscription status could not be loaded; the server will verify access. "}
                  Creating a voice card sends this audio to our AI transcription provider.
                  The saved transcript can be viewed by conversation participants who have Premium Plus.
                </p>
                {subscriptionError && (
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Refresh subscription status
                  </Button>
                )}
                <Button onClick={() => setConsented(true)}>
                  Transcribe and create card
                </Button>
              </motion.div>
            )}

            {/* Loading transcription */}
            {canRequest && consented && loadingTx && (
              <motion.div key="loading-tx" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">Transcribing voice note…</p>
              </motion.div>
            )}

            {/* Error */}
            {canRequest && consented && error && !loadingTx && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 gap-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-destructive text-center">{error}</p>
                <div className="flex gap-2">
                  {errorDetails?.retryable && (
                    <Button onClick={handleRetry} variant="outline" size="sm">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try a new attempt
                    </Button>
                  )}
                  {errorDetails?.isQuotaExhausted && (
                    <Button asChild size="sm"><Link to="/pricing">View plans</Link></Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Rendering or result */}
            {canRequest && consented && !loadingTx && !error && (
              <motion.div key="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                {/* Hidden render canvas */}
                <canvas ref={canvasRef} style={{ display: "none" }} />

                {/* Preview */}
                <div className="relative rounded-xl overflow-hidden border border-border/40 bg-secondary/30 aspect-square">
                  {cardUrl ? (
                    <img src={cardUrl} alt="Voice card preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  )}
                  {rendering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  )}
                </div>

                {/* Actions */}
                {cardUrl && (
                  <div className="flex gap-2">
                    <Button onClick={handleDownload} size="sm" className="flex-1">
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                    </Button>
                    <Button onClick={handleShare} size="sm" variant="outline" className="flex-1">
                      <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
                    </Button>
                    <Button onClick={renderCard} size="sm" variant="ghost" className="px-2.5" title="Regenerate">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground text-center">
                  1080×1080 • Watermarked with {APP_URL}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}