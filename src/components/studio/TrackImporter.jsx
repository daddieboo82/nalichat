import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
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
  const [trackTypes, setTrackTypes] = useState({});
  const fileInputRef = useRef(null);

  const trackTypeOptions = ["vocal", "instrument", "beat", "sample", "fx", "master"];
  
  const setTrackType = (itemId, type) => {
    setTrackTypes(prev => ({ ...prev, [itemId]: type }));
  };

  const getTrackType = (itemId) => trackTypes[itemId] || "vocal";

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
          type: getTrackType(item.id),
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
    
    // Auto-close after successful upload
    const allSuccess = pendingItems.every(item => 
      queue.some(q => q.id === item.id && q.status === "success")
    );
    if (allSuccess && pendingItems.length > 0) {
      setTimeout(() => {
        setQueue([]);
        setOpen(false);
      }, 1500);
    }
  };

  const clearQueue = () => {
   const remaining = queue.filter(item => item.status !== "success");
   setQueue(remaining);
   if (remaining.length === 0) {
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
            className="rounded-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 font-semibold shadow-sm shadow-primary/20 transition-all text-xs h-8"
            onClick={() => {
              if (queue.length === 0) {
                fileInputRef.current?.click();
              } else {
                setOpen(true);
              }
            }}
          >
            <Upload className="w-3 h-3 mr-1" />
            Import
          </Button>
        </div>

        <DialogContent className="bg-card border-border shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">Import Audio Tracks</DialogTitle>
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
              <p className="text-[11px] text-muted-foreground mb-2">
                MP3, WAV, FLAC, OGG, AAC, M4A, WebM
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
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <AnimatePresence>
                {queue.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-start gap-2 p-2 rounded-lg bg-secondary/40 border border-border/50"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {item.status === "pending" && (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      {item.status === "uploading" && (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      )}
                      {item.status === "success" && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {item.status === "error" && (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-xs font-medium truncate">{item.name}</p>
                       {item.status === "pending" && (
                          <Select value={getTrackType(item.id)} onValueChange={(type) => setTrackType(item.id, type)}>
                            <SelectTrigger className="h-6 text-[10px] mt-0.5 bg-secondary/40 border-border/50 rounded-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {trackTypeOptions.map(type => (
                                <SelectItem key={type} value={type} className="text-[10px] capitalize">{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {item.error && (
                          <p className="text-[10px] text-destructive mt-0.5">{item.error}</p>
                        )}
                        {item.status === "uploading" && (
                          <div className="w-full h-0.5 bg-secondary rounded-full mt-1.5 overflow-hidden">
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
           <div className="flex gap-2 pt-3 border-t border-border/50">
             <Button
               variant="outline"
               className="flex-1 h-8 text-xs rounded-lg"
               onClick={clearQueue}
               disabled={uploading}
             >
               Clear
             </Button>
             <Button
               className="flex-1 bg-primary hover:bg-primary/90 h-8 text-xs rounded-lg"
               onClick={uploadTracks}
               disabled={uploading || pendingCount === 0}
             >
               {uploading ? (
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