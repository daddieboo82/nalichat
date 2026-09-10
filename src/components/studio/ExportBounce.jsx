import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Download, Loader2, Award } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AudioAnalysisPanel from "./AudioAnalysisPanel";
import MasterPresets from "./MasterPresets";
import { toast } from "sonner";

const EXPORT_FORMATS = {
  mp3: { label: "MP3", bitrate: "320kbps", size: "small", quality: "High Quality" },
  wav: { label: "WAV", bitrate: "Lossless", size: "large", quality: "Studio Reference" },
  flac: { label: "FLAC", bitrate: "Lossless", size: "medium", quality: "Archival Quality" },
  aac: { label: "AAC", bitrate: "256kbps", size: "small", quality: "Professional Distribution" },
  ogg: { label: "OGG", bitrate: "320kbps", size: "small", quality: "Professional Quality" },
  m4a: { label: "M4A", bitrate: "256kbps", size: "small", quality: "Professional Mastered" },
};

const LOUDNESS_STANDARDS = {
  spotify: { platform: "Spotify", lufs: "-14 LUFS", tp: "-1.0 dBFS" },
  apple: { platform: "Apple Music", lufs: "-16 LUFS", tp: "-1.0 dBFS" },
  youtube: { platform: "YouTube", lufs: "-13 LUFS", tp: "-1.0 dBFS" },
  tidal: { platform: "Tidal", lufs: "-14 LUFS", tp: "-1.0 dBFS" },
  streaming: { platform: "Universal Streaming", lufs: "-14 LUFS", tp: "-1.0 dBFS" },
};

export default function ExportBounce({ audioUrl, title, disabled }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState("mp3");
  const [loudnessStandard, setLoudnessStandard] = useState("streaming");
  const [bitDepth, setBitDepth] = useState("24bit");
  const [sampleRate, setSampleRate] = useState("44.1khz");
  const [exporting, setExporting] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleExport = async () => {
    if (!audioUrl) return;

    setExporting(true);
    setProcessing(true);
    try {
      // Call backend to bounce and master
      const response = await base44.functions.invoke("bounceAndMaster", {
        audioUrl,
        loudnessTarget: loudnessStandard,
        format,
        bitDepth,
        sampleRate,
      });

      setAnalysis(response.data.analysis);

      // The current backend returns analysis only. Never label the input as a
      // mastered file; download only when a processing service provides an
      // actual output URL.
      const exportedUrl = response.data?.audioUrl || response.data?.audio_url || response.data?.signed_url;
      if (exportedUrl) {
        const link = document.createElement("a");
        link.href = exportedUrl;
        link.download = `${title || "export"}-mastered.${format}`;
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
    setBitDepth(settings.bitDepth);
    setSampleRate(settings.sampleRate);
  };

  const selectedFormat = EXPORT_FORMATS[format];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-xl"
          disabled={disabled || !audioUrl}
          title="Export/Bounce track in various formats"
        >
          <Download className="w-4 h-4 mr-2" />
          Export & Bounce
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border shadow-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Export Track</DialogTitle>
          <DialogDescription>
            Choose your preferred audio format and settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Master Presets */}
          {!analysis && <MasterPresets onSelect={applyPreset} />}

          {/* Analysis Panel */}
          {analysis && (
            <AudioAnalysisPanel analysis={analysis} isProcessing={processing} />
          )}

          {/* Format Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground block">
              Audio Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(EXPORT_FORMATS).map(([key, formatInfo]) => (
                <button
                  key={key}
                  onClick={() => setFormat(key)}
                  className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                    format === key
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-secondary/30 hover:border-primary/30"
                  }`}
                >
                  <div className="font-semibold text-sm">{formatInfo.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatInfo.bitrate}
                  </div>
                  {format === key && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

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

          {/* Technical Specs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground block">
                Bit Depth
              </label>
              <Select value={bitDepth} onValueChange={setBitDepth}>
                <SelectTrigger className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border/50 text-xs focus:border-primary/50 outline-none cursor-pointer h-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16bit">16-bit (CD)</SelectItem>
                  <SelectItem value="24bit">24-bit (Studio)</SelectItem>
                  <SelectItem value="32bit">32-bit (High Res)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground block">
                Sample Rate
              </label>
              <Select value={sampleRate} onValueChange={setSampleRate}>
                <SelectTrigger className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border/50 text-xs focus:border-primary/50 outline-none cursor-pointer h-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="44.1khz">44.1 kHz (CD)</SelectItem>
                  <SelectItem value="48khz">48 kHz (Video)</SelectItem>
                  <SelectItem value="96khz">96 kHz (Mastering)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Professional Info */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
            <div className="flex gap-2">
              <Award className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs text-primary/80">
                <p className="font-semibold mb-1">Professional Mastering Standards</p>
                <ul className="space-y-1 text-primary/70">
                  <li>• {LOUDNESS_STANDARDS[loudnessStandard].platform} optimized ({LOUDNESS_STANDARDS[loudnessStandard].lufs})</li>
                  <li>• {bitDepth} resolution for pristine quality</li>
                  <li>• {sampleRate} sample rate for optimal playback</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={exporting || !audioUrl}
            className="w-full rounded-xl bg-primary hover:bg-primary/90 font-semibold"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export as {format.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}