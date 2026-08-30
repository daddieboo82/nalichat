import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { renderMixToWav, renderMixToMp3 } from "@/lib/audioProcessing";
import { getSquadBonusStatus, BONUS_MULTIPLIER } from "@/lib/squadBonus";

const EXPORT_PRICES = { wav: 1.99, mp3: 0.99 };
const EXPORT_LABELS = { wav: "WAV (Studio Quality)", mp3: "MP3 (Compressed)" };

export default function ExportPurchaseDialog({ open, onOpenChange, format, tracks, projectName }) {
  const [stage, setStage] = useState("idle"); // idle | rendering | uploading | redirecting
  const [bonusActive, setBonusActive] = useState(false);
  const basePrice = EXPORT_PRICES[format] || 1.99;
  const price = bonusActive ? Math.round((basePrice / BONUS_MULTIPLIER) * 100) / 100 : basePrice;

  useEffect(() => {
    if (!open) return;
    base44.auth.me().then((u) => getSquadBonusStatus(u)).then((s) => setBonusActive(s.active)).catch(() => {});
  }, [open]);

  const handlePurchase = async () => {
    setStage("rendering");
    try {
      // 1. Render the mix to a blob
      const blob = format === "mp3" ? await renderMixToMp3(tracks) : await renderMixToWav(tracks);
      if (!blob) {
        toast.error("No audio to export. Record or import a track first.");
        setStage("idle");
        return;
      }

      // 2. Upload as a private file so it survives the checkout redirect
      setStage("uploading");
      const fileName = `${projectName || "NaliStudio Mix"}.${format}`;
      const file = new File([blob], fileName, { type: format === "mp3" ? "audio/mp3" : "audio/wav" });
      const uploadRes = await base44.integrations.Core.UploadPrivateFile({ file });
      const fileUri = uploadRes.file_uri;

      // 3. Stash the file URI so the ThankYou page can deliver it after payment
      localStorage.setItem("pending_studio_export", JSON.stringify({
        fileUri,
        format,
        fileName,
        timestamp: Date.now(),
      }));

      // 4. Create a Wix checkout session and redirect
      setStage("redirecting");
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'conversion', {
          send_to: 'AW-18416125487/OnfzCI7a5OkcEK-Mv81E',
          value: price,
          currency: 'USD',
        });
      }
      try { localStorage.setItem('gads_purchase_value', String(price)); } catch {}
      const res = await base44.functions.invoke("createCheckout", {
        items: [{
          name: `Studio Export - ${format.toUpperCase()} Download`,
          price: price,
          quantity: 1,
        }],
        callbackUrls: {
          thankYouPageUrl: window.location.origin + "/ThankYou?export=download",
          postFlowUrl: window.location.origin + "/studio",
        },
      });

      if (res.data && res.data.checkoutUrl) {
        window.top.location.href = res.data.checkoutUrl;
      } else {
        toast.error("Checkout failed. Please try again.");
        setStage("idle");
      }
    } catch (error) {
      console.error("Export purchase error:", error);
      toast.error("Failed to process export. Please try again.");
      setStage("idle");
    }
  };

  const handleOpenChange = (val) => {
    if (stage !== "idle") return; // don't allow closing mid-process
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center mx-auto mb-4">
            <Download className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-center font-heading text-xl">
            Export Mix ({(format || "").toUpperCase()})
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground mt-2">
            Render and download your mixed track as a {EXPORT_LABELS[format] || "high-quality"} file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Format</span>
              <span className="text-sm text-muted-foreground">{EXPORT_LABELS[format]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Price</span>
              <span className="flex items-center gap-2">
                {bonusActive && <span className="text-xs text-muted-foreground line-through">${basePrice.toFixed(2)}</span>}
                <span className="text-lg font-bold text-primary">${price.toFixed(2)}</span>
              </span>
            </div>
          </div>

          {bonusActive && (
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0" /> Squad weekend bonus applied — {BONUS_MULTIPLIER}x discount
            </div>
          )}

          {stage !== "idle" && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              {stage === "rendering" && "Rendering your mix…"}
              {stage === "uploading" && "Preparing file for download…"}
              {stage === "redirecting" && "Redirecting to secure checkout…"}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={stage !== "idle"}>
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={stage !== "idle"}
            className="bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-white"
          >
            {stage === "idle" ? (
              <>
                <Download className="w-4 h-4 mr-2" />
                Pay ${price.toFixed(2)} & Download
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing…
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}