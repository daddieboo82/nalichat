import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2, RefreshCw, ImageIcon, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// Shared cache so we don't re-transcribe the same voice note every render.
const transcriptionCache = new Map();

const APP_URL = "nalichat.org";
const CARD_SIZE = 1080;

async function fetchTranscription(_fileUrl, messageId) {
  if (transcriptionCache.has(messageId)) return transcriptionCache.get(messageId);
  const res = await base44.functions.invoke("transcribeMessageAudio", { messageId });
  if (res?.data?.error) throw new Error(res.data.error);
  const text = res?.data?.text || "";
  const clean = typeof text === "string" ? text.trim() : String(text).trim();
  if (clean) {
    transcriptionCache.set(messageId, clean);
    return clean;
  }
  return "";
}

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
  const canvasRef = useRef(null);
  const [transcription, setTranscription] = useState(null);
  const [loadingTx, setLoadingTx] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [cardUrl, setCardUrl] = useState(null);
  const [error, setError] = useState(null);

  const reset = () => {
    setTranscription(null);
    setLoadingTx(false);
    setRendering(false);
    setCardUrl(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Fetch transcription when dialog opens
  useEffect(() => {
    if (!isOpen || !message?.file_url || !message?.id) return;
    if (transcription !== null) return;
    let cancelled = false;
    setLoadingTx(true);
    setError(null);
    fetchTranscription(message.file_url, message.id)
      .then((text) => {
        if (cancelled) return;
        setTranscription(text || "");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't transcribe this voice note. Try again!");
      })
      .finally(() => {
        if (!cancelled) setLoadingTx(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, message?.file_url, message?.id, transcription]);

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
      if (!res.ok) throw new Error(`Voice card fetch failed: ${res.status}`);
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
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("Couldn't share the voice card. Please try again.");
      }
    }
  };

  const handleRetry = () => {
    transcriptionCache.delete(message?.id);
    reset();
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
            {/* Loading transcription */}
            {loadingTx && (
              <motion.div key="loading-tx" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">Transcribing voice note…</p>
              </motion.div>
            )}

            {/* Error */}
            {error && !loadingTx && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 gap-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-destructive text-center">{error}</p>
                <Button onClick={handleRetry} variant="outline" size="sm">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try Again
                </Button>
              </motion.div>
            )}

            {/* Rendering or result */}
            {!loadingTx && !error && (
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