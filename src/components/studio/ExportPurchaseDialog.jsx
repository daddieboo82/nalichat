import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { renderMixToWav, renderMixToMp3 } from "@/lib/audioProcessing";

const EXPORT_LABELS = { wav: "WAV (Studio Quality)", mp3: "MP3 (Compressed)" };

export default function ExportPurchaseDialog({ open, onOpenChange, format, tracks, projectName }) {
  const [stage, setStage] = useState("idle"); // idle | rendering | downloading

  const handleExport = async () => {
    setStage("rendering");
    try {
      // 1. Render the mix to a blob
      const blob = format === "mp3" ? await renderMixToMp3(tracks) : await renderMixToWav(tracks);
      if (!blob) {
        toast.error("No audio to export. Record or import a track first.");
        setStage("idle");
        return;
      }

      // 2. Trigger a direct download — no payment, no redirect
      setStage("downloading");
      const fileName = `${projectName || "NaliStudio Mix"}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Export complete — check your downloads folder!");
      setStage("idle");
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export. Please try again.");
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
            Render and download your mixed track as a {EXPORT_LABELS[format] || "high-quality"} file. 100% free.
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
              <span className="text-lg font-bold text-accent">Free</span>
            </div>
          </div>

          {stage !== "idle" && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              {stage === "rendering" && "Rendering your mix…"}
              {stage === "downloading" && "Preparing your download…"}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={stage !== "idle"}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={stage !== "idle"}
            className="bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-white"
          >
            {stage === "idle" ? (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download Free
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