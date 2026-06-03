import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Pause, Download, FileText, Music, Film, Reply, Smile, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { resumableDownload } from "@/lib/resumableUpload";
import MediaViewer from "./MediaViewer";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

function ReadReceipts({ readBy, users }) {
  if (!readBy.length) return <span className="text-[10px] text-muted-foreground/50">✓</span>;
  const readers = users.filter(u => readBy.includes(u.id)).slice(0, 3);
  return (
    <div className="flex items-center gap-0.5" title={readers.map(u => u.display_name || u.full_name).join(", ") + " saw this"}>
      {readers.map(u => (
        <Avatar key={u.id} className="w-3.5 h-3.5 border border-background">
          <AvatarImage src={u.avatar_url} />
          <AvatarFallback className="bg-primary/40 text-[6px] font-bold text-primary-foreground">
            {(u.display_name || u.full_name)?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {readBy.length > 3 && <span className="text-[9px] text-muted-foreground">+{readBy.length - 3}</span>}
    </div>
  );
}

function AudioPlayer({ src, duration }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

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
    <div className="flex items-center gap-3 min-w-[200px]">
      <audio ref={audioRef} src={src} onEnded={() => { setPlaying(false); setProgress(0); }} onTimeUpdate={handleTimeUpdate} />
      <button onClick={toggle} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0 hover:bg-white/30 transition-colors">
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="h-1.5 bg-white/20 rounded-full cursor-pointer" onClick={handleSeek}>
          <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[10px] opacity-70">{fmt(currentTime)} / {fmt(duration || 0)}</span>
      </div>
    </div>
  );
}

function FileAttachment({ message, isOwn, onOpenViewer }) {
  const [dlProgress, setDlProgress] = useState(null); // null = idle, 0-100 = downloading
  const isImage = message.type === "image" || message.file_type?.startsWith("image");
  const isAudio = message.type === "audio" || message.file_type?.startsWith("audio");
  const isVideo = message.file_type?.startsWith("video");

  const handleDownload = async (e) => {
    e.preventDefault();
    if (dlProgress !== null) return;
    setDlProgress(0);
    await resumableDownload(message.file_url, message.file_name || "file", (pct) => setDlProgress(pct));
    setDlProgress(null);
  };

  if (isImage) {
    return (
      <div className="relative group">
        <img src={message.file_url} alt={message.file_name} className="rounded-xl w-full max-w-[280px] sm:max-w-[300px] max-h-[220px] object-cover block cursor-pointer hover:brightness-90 transition-all" onClick={() => onOpenViewer(message)} />
        <button onClick={() => onOpenViewer(message)} className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity hover:bg-black/60">
          <Maximize2 className="w-4 h-4 text-white" />
        </button>
        {message.text && <p className="text-sm mt-2">{message.text}</p>}
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="flex flex-col gap-2">
        <AudioPlayer src={message.file_url} duration={message.duration} />
        <button onClick={() => onOpenViewer(message)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
          <Maximize2 className="w-3 h-3" /> Full player
        </button>
      </div>
    );
  }

  const Icon = isVideo ? Film : message.file_type?.startsWith("audio") ? Music : FileText;
  const size = message.file_size ? `${(message.file_size / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <div className="min-w-[180px] sm:min-w-[220px]">
      <button onClick={handleDownload} className="w-full flex items-center gap-3 hover:opacity-80 transition-opacity group text-left">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", isOwn ? "bg-white/20" : "bg-primary/20")}>
          <Icon className={cn("w-5 h-5", isOwn ? "text-white" : "text-primary")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate max-w-[140px] sm:max-w-[180px]">{message.file_name || "File"}</p>
          <p className="text-[10px] opacity-60">
            {dlProgress !== null ? `${dlProgress}%` : size}
          </p>
        </div>
        <Download className={cn("w-4 h-4 shrink-0 transition-opacity", dlProgress !== null ? "opacity-100 text-primary animate-bounce" : "opacity-40 group-hover:opacity-80")} />
      </button>
      {dlProgress !== null && (
        <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/80 rounded-full transition-all duration-200"
            style={{ width: `${dlProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message, isOwn, showAvatar, onReply, onReact, users }) {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const hasFile = message.file_url && message.type !== "text";

  return (
    <div
      className={cn("flex gap-2 group mb-1", isOwn ? "flex-row-reverse" : "flex-row")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
    >
      {/* Avatar */}
      <div className="w-7 shrink-0 mt-auto">
        {showAvatar && !isOwn && (
          <Avatar className="w-7 h-7">
            <AvatarImage src={message.sender_avatar} />
            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
              {message.sender_name?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className={cn("max-w-[70%] flex flex-col", isOwn && "items-end")}>
        {showAvatar && !isOwn && (
          <p className="text-[10px] text-muted-foreground mb-1 ml-1 font-medium">{message.sender_name}</p>
        )}

        {/* Reply-to preview */}
        {message.reply_to_text && (
          <div className={cn("px-3 py-1.5 rounded-xl mb-1 border-l-2 text-xs opacity-70 max-w-full", isOwn ? "bg-primary/30 border-white/40 text-right" : "bg-secondary border-primary")}>
            <p className="font-medium text-[10px] mb-0.5">{message.reply_to_sender}</p>
            <p className="truncate">{message.reply_to_text}</p>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "relative rounded-2xl px-4 py-2.5 min-w-[60px]",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border rounded-bl-md",
          hasFile && message.type !== "audio" && "p-2"
        )}>
          {hasFile ? (
            <FileAttachment message={message} isOwn={isOwn} onOpenViewer={() => setViewerOpen(true)} />
          ) : (
            <p className="text-sm leading-relaxed break-words">{message.text}</p>
          )}
          {hasFile && message.text && message.type !== "audio" && (
            <p className="text-sm mt-2 px-2 pb-1">{message.text}</p>
          )}
        </div>

        {/* Reactions display */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={cn("flex gap-1 flex-wrap mt-1", isOwn && "justify-end")}>
            {Object.entries(message.reactions).map(([emoji, count]) => (
              <button key={emoji} onClick={() => onReact?.(message.id, emoji)}
                className="bg-secondary border border-border rounded-full px-2 py-0.5 text-xs hover:bg-primary/10 transition-colors">
                {emoji} {count > 1 && <span className="opacity-70">{count}</span>}
              </button>
            ))}
          </div>
        )}

        <div className={cn("flex items-center gap-1 mt-0.5", isOwn ? "justify-end mr-1" : "ml-1")}>
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(message.created_date), "h:mm a")}
          </p>
          {isOwn && (
            <ReadReceipts readBy={message.read_by || []} users={users || []} />
          )}
        </div>
      </div>

      {/* Hover action buttons */}
      <div className={cn(
        "flex items-center gap-1 opacity-0 transition-opacity self-center shrink-0",
        showActions && "opacity-100",
        isOwn ? "flex-row order-first mr-1" : "flex-row ml-1"
      )}>
        <div className="relative">
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Smile className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          {showReactions && (
            <div className={cn(
              "absolute bottom-full mb-1 flex gap-1 bg-card border border-border rounded-2xl p-1.5 shadow-xl z-50",
              isOwn ? "right-0" : "left-0"
            )}>
              {QUICK_REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => { onReact?.(message.id, emoji); setShowReactions(false); }}
                  className="text-lg hover:scale-125 transition-transform leading-none p-0.5">
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onReply?.(message)}
          className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-muted transition-colors"
        >
          <Reply className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Media Viewer Modal */}
      <MediaViewer
        media={hasFile ? message : null}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}