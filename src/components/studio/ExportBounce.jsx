import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Loader2, Award } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AudioAnalysisPanel from "./AudioAnalysisPanel";
import MasterPresets from "./MasterPresets";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";

const LOUDNESS_STANDARDS = {
  spotify: { platform: "Spotify", lufs: "-14 LUFS", tp: "-1.0 dBFS" },
  apple: { platform: "Apple Music", lufs: "-16 LUFS", tp: "-1.0 dBFS" },
  youtube: { platform: "YouTube", lufs: "-13 LUFS", tp: "-1.0 dBFS" },
  tidal: { platform: "Tidal", lufs: "-14 LUFS", tp: "-1.0 dBFS" },
  streaming: { platform: "Universal Streaming", lufs: "-14 LUFS", tp: "-1.0 dBFS" },
};

export default function ExportBounce({ postId, title, disabled }) {
  const { hasEntitlement } = useSubscription();
  const canMaster = hasEntitlement("ai.standard");
  const [open, setOpen] = useState(false);
  const [loudnessStandard, setLoudnessStandard] = useState("streaming");
  const [exporting, setExporting] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleExport = async () => {
    if (!canMaster) {
      toast.error("Premium is required for mastering export.");
      return;
    }
    if (!postId) return;

    setExporting(true);
    setProcessing(true);
    try {
      // Call backend to bounce and master
      const response = await base44.functions.invoke("bounceAndMaster", {
        postId,
        loudnessTarget: loudnessStandard,
        format: "mp3",
        bitDepth: "24bit",
        sampleRate: "44.1khz",
      });

      setAnalysis(response.data.analysis);

      // The current backend returns analysis only. Never label the input as a
      // mastered file; download only when a processing service provides an
      // actual output URL.
      const exportedUrl = response.data?.audioUrl || response.data?.audio_url || response.data?.signed_url;
      if (exportedUrl) {
        const link = document.createElement("a");
        link.href = exportedUrl;
        link.download = `${title || "export"}-mastered.mp3`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setOpen(false);
      } else {
        toast.info("Mastering analysis is ready. Audio re-encoding is not available from the current service.");
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
      setProcessing(false);
    }
  };

  const applyPreset = (settings) => {
    setLoudnessStandard(settings.loudnessStandard);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-xl"
          disabled={disabled || !postId || !canMaster}
          title={canMaster ? "Analyze mastering loudness and dynamics" : "Premium is required for mastering analysis"}
        >
          <Award className="w-4 h-4 mr-2" />
          {canMaster ? "Mastering Analysis" : "Premium Analysis"}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border shadow-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Mastering Analysis</DialogTitle>
          <DialogDescription>
            Analyze loudness, dynamics, and mastering targets. Audio re-encoding is not available yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Master Presets */}
          {!analysis && <MasterPresets onSelect={applyPreset} />}

          {/* Analysis Panel */}
          {analysis && (
            <AudioAnalysisPanel analysis={analysis} isProcessing={processing} />
          )}

          {/* Quality Standards */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground block flex items-center gap-2">
              <Award className="w-4 h-4 text-accent" />
              Loudness Standard
            </label>
            <Select value={loudnessStandard} onValueChange={setLoudnessStandard}>
              <SelectTrigger className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border/50 text-sm focus:border-primary/50 outline-none cursor-pointer h-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LOUDNESS_STANDARDS).map(([key, std]) => (
                  <SelectItem key={key} value={key}>
                    {std.platform} ({std.lufs})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Professional Info */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
            <div className="flex gap-2">
              <Award className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs text-primary/80">
                <p className="font-semibold mb-1">Professional Mastering Standards</p>
                <ul className="space-y-1 text-primary/70">
                  <li>• {LOUDNESS_STANDARDS[loudnessStandard].platform} optimized ({LOUDNESS_STANDARDS[loudnessStandard].lufs})</li>
                  <li>• Analyze loudness, peak level, RMS, and dynamic range</li>
                  <li>• No mastered audio file is generated by the current service</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Analysis Button */}
          <Button
            onClick={handleExport}
            disabled={exporting || !postId}
            className="w-full rounded-xl bg-primary hover:bg-primary/90 font-semibold"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Award className="w-4 h-4 mr-2" />
                Run Mastering Analysis
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}