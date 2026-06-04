import { useState, useRef } from "react";
import React from "react";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { resumableDownload } from "@/lib/resumableUpload";
import { cn } from "@/lib/utils";

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
        className="relative bg-card rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
          <h3 className="font-heading font-semibold text-sm truncate">
            {media.file_name || "Media"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-background/50">
          {isImage ? (
            <div className="flex flex-col items-center justify-center gap-4 p-4">
              <img
                src={media.file_url}
                alt={media.file_name}
                className="rounded-xl max-h-[60vh] object-contain"
                style={{ transform: `scale(${zoom / 100})` }}
              />
              {/* Zoom controls */}
              <div className="flex items-center gap-2 bg-secondary/80 rounded-xl p-2">
                <button
                  onClick={() => setZoom((z) => Math.max(50, z - 10))}
                  className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium w-12 text-center">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(200, z + 10))}
                  className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : isAudio ? (
            <div className="w-full max-w-md px-6 py-8">
              <AudioPlayerFull src={media.file_url} duration={media.duration} />
            </div>
          ) : isVideo ? (
            <div className="flex flex-col items-center justify-center gap-4 p-4 w-full h-full">
              <video
                src={media.file_url}
                controls
                autoPlay
                className="rounded-xl max-h-[70vh] max-w-full object-contain"
              />
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border bg-secondary/50 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {media.file_size
              ? `${(media.file_size / 1024 / 1024).toFixed(1)} MB`
              : ""}
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Downloading..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AudioPlayerFull({ src, duration }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = React.useRef(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(pct || 0);
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleSeek = (e) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * audioRef.current.duration;
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="space-y-6 flex flex-col items-center w-full">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={handleTimeUpdate}
      />
      <div className="flex items-center gap-4">
        <button
          onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>
        <button
          onClick={toggle}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center hover:shadow-lg transition-all active:scale-95"
        >
          {playing ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5 3 19 12 5 21" />
            </svg>
          )}
        </button>
        <button
          onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 10); }}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.334-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.334-4z" />
          </svg>
        </button>
      </div>
      <div className="w-full space-y-3">
        <div
          className="h-2 bg-white/20 rounded-full cursor-pointer hover:h-3 transition-all"
          onClick={handleSeek}
        >
          <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
}