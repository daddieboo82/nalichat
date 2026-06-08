import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Music, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";

const SUPPORTED_FORMATS = {
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/flac": ".flac",
  "audio/aac": ".aac",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/webm": ".webm",
};

export default function TrackImporter({ projectId, currentUser, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState([]);
  const fileInputRef = useRef(null);

  const isSupportedFormat = (file) => {
    return file.type.startsWith("audio/") || 
           /\.(mp3|wav|flac|ogg|aac|m4a|webm)$/i.test(file.name);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type !== "dragleave" && e.type !== "drop");
  };

  const handleFiles = (files) => {
    const audioFiles = Array.from(files).filter(isSupportedFormat);
    if (audioFiles.length === 0) return;

    const newItems = audioFiles.map(file => ({
      id: `${file.name}-${Date.now()}`,
      file,
      name: file.name.replace(/\.[^/.]+$/, ""),
      status: "pending",
      error: null,
    }));

    setQueue(prev => [...prev, ...newItems]);
    if (!open) setOpen(true);
  };

  const uploadTracks = async () => {
    setUploading(true);
    const pendingItems = queue.filter(item => item.status === "pending");

    for (const item of pendingItems) {
      try {
        setQueue(prev =>
          prev.map(i =>
            i.id === item.id ? { ...i, status: "uploading" } : i
          )
        );

        const { file_url } = await base44.integrations.Core.UploadFile({
          file: item.file,
        });

        await base44.entities.Track.create({
          project_id: projectId,
          name: item.name,
          file_url,
          type: "vocal",
          volume: 75,
          pan: 0,
          muted: false,
          solo: false,
          uploaded_by: currentUser.id,
        });

        setQueue(prev =>
          prev.map(i =>
            i.id === item.id ? { ...i, status: "success" } : i
          )
        );
      } catch (error) {
        setQueue(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, status: "error", error: error.message }
              : i
          )
        );
      }
    }

    setUploading(false);
    onSuccess?.();
  };

  const clearQueue = () => {
    setQueue(queue.filter(item => item.status !== "success"));
    if (queue.every(item => item.status === "success")) {
      setQueue([]);
      setOpen(false);
    }
  };

  const pendingCount = queue.filter(item => item.status === "pending" || item.status === "uploading").length;
  const successCount = queue.filter(item => item.status === "success").length;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={Object.keys(SUPPORTED_FORMATS).join(",")}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.currentTarget.files)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={(e) => {
            handleDrag(e);
            handleFiles(e.dataTransfer.files);
          }}
          className="relative"
        >
          <Button
            size="sm"
            className="rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 font-semibold shadow-md shadow-primary/20 transition-all hover:scale-105"
            onClick={() => setOpen(true)}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Import Tracks
          </Button>
        </div>

        <DialogContent className="bg-card border-border shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Import Audio Tracks</DialogTitle>
          </DialogHeader>

          {queue.length === 0 ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => {
                handleDrag(e);
                handleFiles(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/50 hover:border-primary/40 bg-secondary/20"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                <Music className="w-7 h-7 text-primary/70" />
              </div>
              <p className="font-medium mb-1">Drag tracks here or click to browse</p>
              <p className="text-xs text-muted-foreground mb-3">
                Supports: MP3, WAV, FLAC, OGG, AAC, M4A, WebM
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Select Files
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  const file = new File(["dummy audio track"], "test-track.mp3", { type: "audio/mpeg" });
                  handleFiles([file]);
                }}
              >
                Mock Upload (Test)
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <AnimatePresence>
                {queue.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border/50"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {item.status === "pending" && (
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      {item.status === "uploading" && (
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      )}
                      {item.status === "success" && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {item.status === "error" && (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {item.error && (
                        <p className="text-xs text-destructive mt-1">{item.error}</p>
                      )}
                      {item.status === "uploading" && (
                        <div className="w-full h-1 bg-secondary rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-primary/50 animate-pulse w-1/3" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {queue.length > 0 && (
            <div className="flex gap-2 pt-4 border-t border-border/50">
              {uploading || pendingCount === 0 ? (
                <>
                  {successCount > 0 && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={clearQueue}
                    >
                      Clear
                    </Button>
                  )}
                  {pendingCount > 0 && (
                    <Button
                      className="flex-1 bg-primary hover:bg-primary/90"
                      onClick={uploadTracks}
                      disabled={uploading || pendingCount === 0}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-1.5" />
                          Upload {pendingCount}
                        </>
                      )}
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}