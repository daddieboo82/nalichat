import { useState, useRef } from "react";
import React from "react";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { resumableDownload } from "@/lib/resumableUpload";
import { cn } from "@/lib/utils";
import CustomMediaPlayer from "../audio/CustomMediaPlayer";

export default function MediaViewer({ media, isOpen, onClose }) {
  const [zoom, setZoom] = useState(100);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen || !media) return null;

  const isImage = media.type === "image" || media.file_type?.startsWith("image");
  const isAudio = media.type === "audio" || media.file_type?.startsWith("audio");
  const isVideo = media.type === "video" || media.file_type?.startsWith("video");

  const handleDownload = async () => {
    setDownloading(true);
    await resumableDownload(media.file_url, media.file_name || "file");
    setDownloading(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-black/95 backdrop-blur-3xl border border-white/10 shadow-2xl rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
          <h3 className="font-heading font-semibold text-sm truncate text-white/90">
            {media.file_name || "Media"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-black/60 relative">
          {(isImage || isVideo) && (
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none z-0"
              style={{
                backgroundImage: `url(${media.file_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(60px)'
              }}
            />
          )}
          {isImage ? (
            <div className="flex flex-col items-center justify-center gap-4 p-4 relative z-10 w-full h-full">
              <img
                src={media.file_url}
                alt={media.file_name}
                className="rounded-xl max-h-[60vh] object-contain shadow-2xl transition-transform"
                style={{ transform: `scale(${zoom / 100})` }}
              />
              {/* Zoom controls */}
              <div className="absolute bottom-4 flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-xl">
                <button
                  onClick={() => setZoom((z) => Math.max(50, z - 10))}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono w-12 text-center text-white/90">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(200, z + 10))}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : isAudio ? (
            <div className="w-full max-w-md px-6 py-8 relative z-10">
              <CustomMediaPlayer src={media.file_url} title={media.file_name || "Audio File"} className="w-full shadow-2xl" />
            </div>
          ) : isVideo ? (
            <div className="flex flex-col items-center justify-center gap-4 p-4 w-full h-full relative z-10">
              <video
                src={media.file_url}
                controls
                autoPlay
                className="rounded-xl max-h-[70vh] max-w-full object-contain shadow-2xl border border-white/10 bg-black/50"
              />
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-white/5 flex items-center justify-between">
          <p className="text-xs text-white/50 font-mono">
            {media.file_size
              ? `${(media.file_size / 1024 / 1024).toFixed(1)} MB`
              : ""}
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-full text-sm font-bold hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:hover:scale-100"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Downloading..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}

// CustomMediaPlayer is now used directly inline.