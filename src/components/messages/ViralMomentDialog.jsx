import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, Download, Share2, RefreshCw, Clapperboard, Image as ImageIcon, Music } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { aiErrorMessage, invokeAiFunction } from "@/lib/aiUsage";

export default function ViralMomentDialog({ message, isOpen, onClose }) {
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const reset = () => {
    setMode(null);
    setLoading(false);
    setResult(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const generate = async (type) => {
    setMode(type);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        messageText: message.text,
        senderName: message.sender_name,
        type,
      };
      // The server resolves and authorizes the stored voice note from its message ID.
      if (!message.text && message.file_url && (message.type === "audio" || message.file_type?.startsWith("audio"))) {
        payload.message_id = message.id;
      }
      const data = await invokeAiFunction("generate-viral-moment", payload);
      setResult(data);
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const buildShareText = () => {
    if (!result) return "";
    if (mode === "meme") {
      return `${result.caption}\n\nMade in NaliChat`;
    }
    const scriptText = result.scenes?.map((s, i) => `Scene ${i + 1} (${s.duration}): ${s.text}`).join("\n");
    return `${result.caption}\n\n${scriptText}\n\n#${result.hashtags?.join(" #")}\n\nMade in NaliChat`;
  };

  const handleCopy = () => {
    copyToClipboard(buildShareText());
    toast.success("Copied to clipboard!");
  };

  const handleShare = async () => {
    const text = buildShareText();
    if (navigator.share) {
      try {
        if (mode === "meme" && result.image_url) {
          try {
            const res = await fetch(result.image_url);
            const blob = await res.blob();
            const file = new File([blob], "nalichat-meme.png", { type: "image/png" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], text });
              return;
            }
          } catch {}
        }
        await navigator.share({ text });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const handleDownloadMeme = async () => {
    if (!result?.image_url) return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = result.image_url;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

      const canvas = document.createElement("canvas");
      const watermarkHeight = 50;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight + watermarkHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      ctx.fillStyle = "rgba(124, 58, 237, 0.95)";
      ctx.fillRect(0, img.naturalHeight, canvas.width, watermarkHeight);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✨ Made in NaliChat", canvas.width / 2, img.naturalHeight + watermarkHeight / 2);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "nalichat-meme.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Downloaded with NaliChat watermark!");
      });
    } catch {
      const a = document.createElement("a");
      a.href = result.image_url;
      a.download = "nalichat-meme.png";
      a.click();
      toast.success("Downloaded!");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md sm:max-w-lg bg-card border-border/60 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-heading">
            <Sparkles className="w-5 h-5 text-primary" />
            Viral Moment
          </DialogTitle>
          <DialogDescription className="text-xs">
            Turn this message into a shareable meme or reel script.
          </DialogDescription>
        </DialogHeader>

        {/* Source message preview */}
        <div className="px-5 pb-3">
          <div className="bg-secondary/60 rounded-lg px-3 py-2 border-l-2 border-primary/40">
            <p className="text-[11px] text-muted-foreground font-medium mb-0.5">{message.sender_name || "You"}</p>
            {message.text ? (
              <p className="text-sm text-foreground line-clamp-3">{message.text}</p>
            ) : message.file_url ? (
              <p className="text-sm text-foreground flex items-center gap-2">
                <Music className="w-4 h-4 text-primary shrink-0" />
                Voice note{message.duration ? ` • ${Math.round(message.duration)}s` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="px-5 pb-5">
          <AnimatePresence mode="wait">
            {/* Choice state */}
            {!mode && !loading && !result && (
              <motion.div key="choice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => generate("meme")}
                  className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-gradient-to-br from-primary/20 to-pink-500/10 border border-primary/30 hover:border-primary/60 hover:from-primary/30 hover:to-pink-500/20 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-heading font-bold text-sm">AI Meme</p>
                    <p className="text-[11px] text-muted-foreground">Image + caption</p>
                  </div>
                </button>

                <button
                  onClick={() => generate("reel")}
                  className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-gradient-to-br from-accent/20 to-cyan-500/10 border border-accent/30 hover:border-accent/60 hover:from-accent/30 hover:to-cyan-500/20 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clapperboard className="w-6 h-6 text-accent" />
                  </div>
                  <div className="text-center">
                    <p className="font-heading font-bold text-sm">AI Reel</p>
                    <p className="text-[11px] text-muted-foreground">Video script</p>
                  </div>
                </button>
              </motion.div>
            )}

            {/* Loading state */}
            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="font-heading font-semibold text-sm">
                    Nali is creating your {mode === "meme" ? "meme" : "reel script"}...
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">This takes a few seconds</p>
                </div>
              </motion.div>
            )}

            {/* Error state */}
            {error && !loading && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 gap-4">
                <p className="text-sm text-destructive text-center">{error}</p>
                <Button onClick={() => generate(mode)} variant="outline" size="sm">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try Again
                </Button>
              </motion.div>
            )}

            {/* Meme result */}
            {result && mode === "meme" && !loading && (
              <motion.div key="meme-result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
                <div className="relative rounded-xl overflow-hidden">
                  <img src={result.image_url} alt="AI meme" className="w-full rounded-xl" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-primary/80 py-1.5 px-3 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-white" />
                    <span className="text-[11px] font-bold text-white tracking-wide">Made in NaliChat</span>
                  </div>
                </div>
                <div className="bg-secondary/60 rounded-lg px-3 py-2.5">
                  <p className="text-sm font-medium text-center">{result.caption}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleDownloadMeme} size="sm" className="flex-1">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                  </Button>
                  <Button onClick={handleShare} size="sm" variant="outline" className="flex-1">
                    <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
                  </Button>
                  <Button onClick={() => generate("meme")} size="sm" variant="ghost" className="px-2.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Reel result */}
            {result && mode === "reel" && !loading && (
              <motion.div key="reel-result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <Clapperboard className="w-4 h-4 text-accent" />
                  <p className="text-xs font-heading font-semibold text-muted-foreground">REEL SCRIPT</p>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {result.scenes?.map((scene, i) => (
                    <div key={i} className="bg-secondary/60 rounded-lg p-2.5 border-l-2 border-accent/40">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-accent">SCENE {i + 1}</span>
                        <span className="text-[10px] text-muted-foreground">{scene.duration}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-1">{scene.visual}</p>
                      <p className="text-sm font-medium">{scene.text}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-secondary/60 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium">{result.caption}</p>
                  <p className="text-[11px] text-primary mt-1">#{result.hashtags?.join(" #")}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCopy} size="sm" className="flex-1">
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Script
                  </Button>
                  <Button onClick={handleShare} size="sm" variant="outline" className="flex-1">
                    <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
                  </Button>
                  <Button onClick={() => generate("reel")} size="sm" variant="ghost" className="px-2.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}