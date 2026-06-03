import { useState } from "react";
import { Layers, X, Download, Loader2, Trash2, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadFilesAsZip } from "@/lib/downloadZip";

const trackTypeColors = {
  vocal: "bg-primary",
  instrument: "bg-accent",
  beat: "bg-chart-4",
  sample: "bg-chart-3",
  fx: "bg-chart-5",
  master: "bg-foreground",
};

export default function StemQueue({ queue, onRemove, onClear, open, onToggle }) {
  const [exporting, setExporting] = useState(false);

  const exportable = queue.filter(t => t.file_url);

  const handleExport = async () => {
    if (exportable.length === 0) return;
    setExporting(true);
    try {
      await downloadFilesAsZip(
        exportable.map(t => ({
          file_url: t.file_url,
          name: `${t.name || "stem"}.${(t.file_url.split(".").pop() || "audio").split("?")[0]}`,
        })),
        "stems-queue.zip"
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={cn(
          "relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
          open ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        title="Stem Queue"
      >
        <Layers className="w-4 h-4" />
        {queue.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {queue.length}
          </span>
        )}
      </button>

      {/* Queue panel */}
      {open && (
        <div className="absolute right-4 top-16 z-30 w-80 bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 flex flex-col max-h-[70vh]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Layers className="w-4 h-4 text-primary" />
            <p className="font-heading font-bold text-sm flex-1">Stem Queue</p>
            <span className="text-xs text-muted-foreground">{queue.length} stem{queue.length !== 1 ? "s" : ""}</span>
            <button onClick={onToggle} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {queue.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ListPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Queue is empty</p>
                <p className="text-xs mt-1">Add stems from the tracks below to batch export them.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {queue.map(track => (
                  <div key={track.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-2.5 py-2">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", trackTypeColors[track.type] || "bg-muted")} />
                    <span className="text-xs flex-1 truncate">{track.name}</span>
                    {!track.file_url && <span className="text-[9px] text-muted-foreground">no audio</span>}
                    <button onClick={() => onRemove(track.id)} className="text-muted-foreground hover:text-destructive p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {queue.length > 0 && (
            <div className="p-3 border-t border-border flex gap-2">
              <button
                onClick={onClear}
                className="px-3 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || exportable.length === 0}
                className="flex-1 px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export {exportable.length} stem{exportable.length !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}