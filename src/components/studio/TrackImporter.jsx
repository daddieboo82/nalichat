import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Music, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
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

const TRACK_TYPES = ["vocal", "instrument", "beat", "sample", "fx"];

export default function TrackImporter({ projectId, currentUser, onSuccess, onRefreshTracks }) {
  const [open, setOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
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

    const newUploads = audioFiles.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      name: file.name.replace(/\.[^/.]+$/, ""),
      type: "vocal",
      status: "pending",
      error: null,
    }));

    setUploads(prev => [...prev, ...newUploads]);
  };

  const updateUpload = (id, updates) => {
    setUploads(prev =>
      prev.map(u => u.id === id ? { ...u, ...updates } : u)
    );
  };

  const removeUpload = (id) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const handleUpload = async () => {
    setIsUploading(true);
    const pending = uploads.filter(u => u.status === "pending");

    for (const upload of pending) {
      try {
        updateUpload(upload.id, { status: "uploading" });

        const { file_url } = await base44.integrations.Core.UploadFile({
          file: upload.file,
        });

        await base44.entities.Track.create({
          project_id: projectId,
          name: upload.name,
          file_url,
          type: upload.type,
          volume: 75,
          pan: 0,
          muted: false,
          solo: false,
          uploaded_by: currentUser.id,
        });

        updateUpload(upload.id, { status: "success" });
      } catch (error) {
        console.error(`Upload failed for ${upload.name}:`, error);
        updateUpload(upload.id, { 
          status: "error", 
          error: error.message || "Upload failed" 
        });
      }
    }

    setIsUploading(false);
    onSuccess?.();
    onRefreshTracks?.();

    // Auto-close after success
    const allSuccess = uploads.every(u => u.status === "success" || u.status === "error");
    if (allSuccess && pending.length > 0) {
      setTimeout(() => {
        setUploads([]);
        setOpen(false);
      }, 1500);
    }
  };

  const clearCompleted = () => {
    setUploads(prev => prev.filter(u => u.status === "pending"));
  };

  const pendingCount = uploads.filter(u => u.status === "pending").length;
  const completedCount = uploads.filter(u => u.status === "success").length;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={Object.keys(SUPPORTED_FORMATS).join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.currentTarget.files);
          setOpen(true);
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={(e) => {
            handleDrag(e);
            handleFiles(e.dataTransfer.files);
            setOpen(true);
          }}
        >
          <Button
            size="sm"
            className="rounded-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 font-semibold shadow-sm shadow-primary/20 transition-all text-xs h-8"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3 h-3 mr-1" />
            Import
          </Button>
        </div>

        <DialogContent className="bg-card border-border shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">Import Audio Tracks</DialogTitle>
          </DialogHeader>

          {uploads.length === 0 ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => {
                handleDrag(e);
                handleFiles(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/50 hover:border-primary/40 bg-secondary/20"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                <Music className="w-5 h-5 text-primary/70" />
              </div>
              <p className="font-medium text-sm mb-1">Drag tracks here or click</p>
              <p className="text-[11px] text-muted-foreground">
                MP3, WAV, FLAC, OGG, AAC, M4A, WebM
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <AnimatePresence>
                {uploads.map((upload) => (
                  <motion.div
                    key={upload.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-start gap-2 p-2 rounded-lg bg-secondary/40 border border-border/50"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {upload.status === "pending" && (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      {upload.status === "uploading" && (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      )}
                      {upload.status === "success" && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {upload.status === "error" && (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{upload.name}</p>
                      
                      {upload.status === "pending" && (
                        <Select value={upload.type} onValueChange={(type) => updateUpload(upload.id, { type })}>
                          <SelectTrigger className="h-6 text-[10px] mt-0.5 bg-secondary/40 border-border/50 rounded-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRACK_TYPES.map(type => (
                              <SelectItem key={type} value={type} className="text-[10px] capitalize">
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {upload.status === "uploading" && (
                        <div className="w-full h-0.5 bg-secondary rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-primary/50 animate-pulse w-1/3" />
                        </div>
                      )}

                      {upload.error && (
                        <p className="text-[10px] text-destructive mt-0.5">{upload.error}</p>
                      )}
                    </div>

                    {upload.status === "pending" && (
                      <button
                        onClick={() => removeUpload(upload.id)}
                        className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {uploads.length > 0 && (
            <div className="flex gap-2 pt-3 border-t border-border/50">
              <Button
                variant="outline"
                className="flex-1 h-8 text-xs rounded-lg"
                onClick={clearCompleted}
                disabled={isUploading}
              >
                Clear
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 h-8 text-xs rounded-lg"
                onClick={handleUpload}
                disabled={isUploading || pendingCount === 0}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3 mr-1" />
                    Upload {pendingCount}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}