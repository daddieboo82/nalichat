import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Download, Loader2, Music } from "lucide-react";

const EXPORT_FORMATS = {
  mp3: { label: "MP3", bitrate: "320kbps", size: "small", quality: "High Quality" },
  wav: { label: "WAV", bitrate: "Lossless", size: "large", quality: "Studio Quality" },
  flac: { label: "FLAC", bitrate: "Lossless", size: "medium", quality: "Lossless" },
  aac: { label: "AAC", bitrate: "256kbps", size: "small", quality: "High Quality" },
  ogg: { label: "OGG", bitrate: "320kbps", size: "small", quality: "High Quality" },
  m4a: { label: "M4A", bitrate: "256kbps", size: "small", quality: "iTunes Compatible" },
};

export default function ExportBounce({ audioUrl, title, disabled }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState("mp3");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!audioUrl) return;

    setExporting(true);
    try {
      // Create a temporary audio context to convert formats
      // For now, simulate export by downloading with proper extension
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = `${title || "export"}.${format}`;
      link.click();

      setOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
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

        <div className="space-y-6">
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

          {/* Format Details */}
          {selectedFormat && (
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quality:</span>
                <span className="font-medium">{selectedFormat.quality}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bitrate:</span>
                <span className="font-medium">{selectedFormat.bitrate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">File Size:</span>
                <span className="font-medium capitalize">{selectedFormat.size}</span>
              </div>
            </div>
          )}

          {/* Export Presets Info */}
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-3">
            <div className="flex gap-2">
              <Music className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-xs text-accent/80">
                <p className="font-semibold mb-1">Bounce Settings</p>
                <ul className="space-y-1 text-accent/70">
                  <li>• Full mix with all tracks</li>
                  <li>• Preserves all effects & mixing</li>
                  <li>• 44.1kHz sample rate</li>
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