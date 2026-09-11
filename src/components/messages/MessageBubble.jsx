import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, FileText, Music, Film, Reply, Smile, Maximize2, MessageSquareQuote, MessageSquare, Copy, Trash2, Pencil, Sparkles, Volume2, Share2, Flag } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { resumableDownload } from "@/lib/resumableUpload";
import MediaViewer from "./MediaViewer";
import EmojiReactionPicker from "./EmojiReactionPicker";
import CustomMediaPlayer from "../audio/CustomMediaPlayer";
import ChatSessionViewer from "./ChatSessionViewer";
import ViralMomentDialog from "./ViralMomentDialog";
import VoiceCardDialog from "./VoiceCardDialog";
import MessageContextMenu from "./MessageContextMenu";
import VoiceTranscription from "./VoiceTranscription";
import SwipeToReply from "./SwipeToReply";
import ReportContentDialog from "@/components/ReportContentDialog";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

// Speak text aloud via the generate-speech backend function (Nali "honey" voice).
const speakingAudios = new Map();
async function speakText(text) {
  if (!text) return;
  // Stop any currently playing TTS
  for (const a of speakingAudios.values()) { try { a.pause(); } catch {} }
  speakingAudios.clear();
  try {
    const res = await base44.functions.invoke("generate-speech", { text: text.slice(0, 1000), voice: "honey" });
    const url = res?.data?.url;
    if (!url) return;
    const audio = new Audio(url);
    speakingAudios.set(text, audio);
    audio.onended = () => speakingAudios.delete(text);
    audio.onerror = () => speakingAudios.delete(text);
    await audio.play();
  } catch (e) {
    console.error("TTS error", e);
  }
}

function ReadReceipts({ readBy, users }) {
  if (!readBy.length) return <span className="chat-delivery-state text-[10px] text-muted-foreground/50">✓</span>;
  const readers = users.filter(u => readBy.includes(u.id)).slice(0, 3);
  return (
    <div className="chat-delivery-state flex items-center gap-0.5" title={readers.map(u => u.display_name || u.full_name).join(", ") + " saw this"}>
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



function FileAttachment({ message, isOwn, onOpenViewer, canTranscribe, canDownload }) {
  const [dlProgress, setDlProgress] = useState(null); // null = idle, 0-100 = downloading
  const isImage = message.type === "image" || message.file_type?.startsWith("image");
  const isAudio = message.type === "audio" || message.file_type?.startsWith("audio") || !!message.file_name?.match(/\.(mp3|wav|ogg|m4a|aac)$/i) || !!message.file_url?.match(/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i);
  const isVideo = message.file_type?.startsWith("video");

  const handleDownload = async (e) => {
    e.preventDefault();
    if (dlProgress !== null) return;
    setDlProgress(0);
    try {
      const auth = await base44.functions.invoke("authorizeMessageDownload", { messageId: message.id });
      if (auth?.data?.error) throw new Error(auth.data.error);
      const downloadUrl = auth?.data?.file_url;
      if (!downloadUrl) throw new Error("Download URL unavailable");
      await resumableDownload(downloadUrl, auth?.data?.file_name || message.file_name || "file", (pct) => setDlProgress(pct));
    } catch (error) {
      toast.error(error?.message || "Couldn't download the attachment. Please try again.");
    } finally {
      setDlProgress(null);
    }
  };

  if (isImage) {
    return (
      <div className="relative group">
        <img src={message.file_url} alt={message.file_name} loading="lazy" decoding="async" className="rounded-xl w-full max-w-[280px] sm:max-w-[300px] max-h-[220px] object-cover block cursor-pointer hover:brightness-90 transition-all" onClick={() => onOpenViewer(message)} />
        <button onClick={() => onOpenViewer(message)} className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity hover:bg-black/60" title="Expand Image" aria-label="Expand Image">
          <Maximize2 className="w-4 h-4 text-white" />
        </button>
        {message.text && <p className="text-sm mt-2">{message.text}</p>}
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="flex flex-col gap-2 min-w-[200px] sm:min-w-[240px]">
        <CustomMediaPlayer src={message.file_url} title={message.file_name || "Audio Message"} className="shadow-md" />
        {canTranscribe && <VoiceTranscription message={message} isOwn={isOwn} />}
        <button onClick={() => onOpenViewer(message)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-end gap-1 transition-colors mt-1 font-medium px-1">
          <Maximize2 className="w-3 h-3" /> Open full viewer
        </button>
      </div>
    );
  }

  const Icon = isVideo ? Film : message.file_type?.startsWith("audio") ? Music : FileText;
  const size = message.file_size ? `${(message.file_size / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <div className="min-w-[180px] sm:min-w-[220px]">
      <button onClick={canDownload ? handleDownload : undefined} disabled={!canDownload} className="w-full flex items-center gap-3 hover:opacity-80 transition-opacity group text-left disabled:opacity-50 disabled:cursor-not-allowed" title={canDownload ? "Download File" : "Premium is required to download this attachment"} aria-label={canDownload ? "Download File" : "Download locked"}>
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

const gradients = ["from-primary to-pink-500","from-accent to-cyan-400","from-yellow-500 to-orange-500","from-green-400 to-emerald-600","from-purple-500 to-indigo-500"];
const getGradient = (name) => gradients[(name?.charCodeAt(0) || 0) % gradients.length];

import React from "react";

export default React.memo(function MessageBubble({ message, isOwn, canDelete, showAvatar, onReply, onEdit, onReact, onOpenThread, users, onCopy, onDelete, currentUser, onPlayAudio, onStartDM }) {
  const { hasEntitlement } = useSubscription();
  const canUseAi = hasEntitlement("ai.standard");
  const canTranscribe = hasEntitlement("voice.transcription");
  const canDownload = isOwn || hasEntitlement("chat.export");
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viralOpen, setViralOpen] = useState(false);
  const [voiceCardOpen, setVoiceCardOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const longPressTimer = useRef(null);

  const hasFile = message.file_url && message.type !== "text";
  const isAudioMessage = !!(message.file_url && (message.type === "audio" || message.file_type?.startsWith("audio") || message.file_name?.match(/\.(mp3|wav|ogg|m4a|aac)$/i)));
  const canGoViral = canUseAi && !!(message.text || isAudioMessage);
  const canShareVoiceCard = canTranscribe && !!isAudioMessage;

  const showContextMenu = (x, y) => {
    const menuW = 200, menuH = 320;
    setContextMenuPos({
      x: Math.min(x, window.innerWidth - menuW - 16),
      y: Math.min(y, window.innerHeight - menuH - 16),
    });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      showContextMenu(touch.clientX, touch.clientY);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  const avatarGradient = getGradient(message.sender_name);

  const handleReact = (emoji) => {
    if (navigator.vibrate) navigator.vibrate(15);
    onReact?.(message.id, emoji);
  };

  return (
    <SwipeToReply isOwn={isOwn} onReply={() => { if (navigator.vibrate) navigator.vibrate(20); onReply?.(message); }} disabled={!onReply}>
    <motion.div
      id={`message-${message.id}`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("flex gap-2 group mb-0.5 py-0.5", isOwn ? "flex-row-reverse" : "flex-row", showAvatar ? "mt-4" : "mt-0.5")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* Avatar */}
      <div className="w-8 shrink-0 mt-auto">
        {showAvatar && !isOwn ? (
          <Avatar className="w-8 h-8 shadow-md">
            <AvatarImage src={message.sender_avatar} />
            <AvatarFallback className={cn("text-[10px] font-bold text-white bg-gradient-to-br", avatarGradient)}>
              {message.sender_name?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      <div className={cn("max-w-[72%] sm:max-w-[65%] flex flex-col", isOwn && "items-end", message.type === "session" && "max-w-[90%] sm:max-w-[85%]")}>
        {showAvatar && !isOwn && (
          <p className="chat-message-meta text-[11px] text-muted-foreground/70 mb-1 ml-1 font-semibold">{message.sender_name}</p>
        )}

        {/* Reply-to preview */}
        {message.reply_to_text && (
          <div className={cn("px-3 py-1.5 rounded-xl mb-1.5 border-l-2 text-xs max-w-full backdrop-blur-sm", isOwn ? "chat-reply-preview--own bg-white/10 border-white/30 text-right" : "chat-reply-preview--other bg-secondary/60 border-primary/50")}>
            <p className="chat-reply-sender font-semibold text-[10px] mb-0.5 text-primary">{message.reply_to_sender}</p>
            <p className="truncate opacity-70">{message.reply_to_text}</p>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "relative rounded-2xl min-w-[60px] transition-all",
          isOwn
            ? "chat-message-own bg-gradient-to-br from-primary via-primary to-pink-500 text-white rounded-br-sm shadow-xl shadow-primary/20"
            : "chat-message-other bg-card/80 border border-border/60 rounded-bl-sm shadow-sm backdrop-blur-sm",
          (hasFile && message.type !== "audio") || message.type === "session" ? "p-2" : "px-4 py-2.5",
          message.type === "session" && isOwn && "from-transparent to-transparent bg-transparent text-foreground shadow-none border border-primary/30"
        )}>
          {message.type === "session" ? (
            <ChatSessionViewer message={message} currentUser={currentUser} />
          ) : hasFile ? (
            <FileAttachment message={message} isOwn={isOwn} canTranscribe={canTranscribe} canDownload={canDownload} onOpenViewer={() => {
              if (message.type === "audio" || message.file_type?.startsWith("audio")) {
                onPlayAudio?.(message);
              } else {
                setViewerOpen(true);
              }
            }} />
          ) : (
            <div className={cn("chat-message-text text-[15px] leading-relaxed break-words whitespace-pre-wrap [overflow-wrap:anywhere]", isOwn ? "text-white" : "text-foreground")}>
              <ReactMarkdown
                components={{
                  a: ({node, ...props}) => <a {...props} target="_blank" rel="noreferrer" className="underline font-semibold hover:opacity-80 break-all" />,
                  p: ({node, ...props}) => <p className="mb-1.5 last:mb-0" {...props} />,
                  code: ({node, inline, ...props}) => <code {...props} className={cn("px-1.5 py-0.5 rounded-md text-xs font-mono bg-black/10 dark:bg-white/10")} />
                }}
              >
                {message.text}
              </ReactMarkdown>
            </div>
          )}
          {hasFile && message.text && message.type !== "audio" && message.type !== "session" && (
            <p className="text-sm mt-2 px-2 pb-1">{message.text}</p>
          )}
        </div>

        {/* Reactions display */}
        {(() => {
          const counts = {};
          const reactionEntries = Object.entries(message.reactions || {});
          const userReaction = currentUser
            ? reactionEntries.find(([key]) => key.endsWith(`__${currentUser.id}`))?.[1] || null
            : null;
          for (const [, emoji] of reactionEntries) {
            counts[emoji] = (counts[emoji] || 0) + 1;
          }
          const entries = Object.entries(counts);
          if (entries.length === 0) return null;
          return (
            <div className={cn("flex gap-1 flex-wrap mt-1.5", isOwn && "justify-end")}>
              {entries.map(([emoji, count]) => {
                const hasReacted = userReaction === emoji;
                return (
                  <button key={emoji} onClick={() => handleReact(emoji)}
                    className={cn(
                      "chat-reaction border rounded-full px-2.5 py-0.5 text-xs transition-all hover:scale-105 active:scale-95 shadow-sm",
                      hasReacted ? "bg-primary/20 border-primary/50 text-primary" : "bg-secondary/80 border-border/60 hover:bg-primary/15 hover:border-primary/30"
                    )}>
                    {emoji} {count > 1 && <span className="opacity-60 font-medium ml-1">{count}</span>}
                  </button>
                );
              })}
            </div>
          );
        })()}

        <div className={cn("flex items-center gap-1.5 mt-1", isOwn ? "justify-end mr-1" : "ml-1")}>
          <p className="chat-delivery-state text-[11px] text-muted-foreground/50 font-medium">
            {message.created_date && !isNaN(new Date(message.created_date).getTime()) ? format(new Date(message.created_date), "h:mm a") : "..."}
            {message.is_edited && " • Edited"}
          </p>
          {isOwn && (
            <ReadReceipts readBy={message.read_by || []} users={users || []} />
          )}
        </div>
        {message.thread_reply_count > 0 && (
          <button
            onClick={() => onOpenThread?.(message)}
            className={cn("flex items-center gap-1.5 mt-1 text-[11px] text-primary/70 hover:text-primary transition-colors font-medium", isOwn ? "self-end mr-1" : "ml-1")}
            title="View Replies"
            aria-label="View Replies"
          >
            <MessageSquareQuote className="w-3 h-3" />
            {message.thread_reply_count} {message.thread_reply_count === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {/* Hover action buttons */}
      <div className={cn(
        "hidden md:flex items-center gap-1 opacity-0 focus-within:opacity-100 transition-all self-center shrink-0 relative",
        (showActions || showEmojiPicker) && "opacity-100",
        isOwn ? "flex-row mr-2" : "flex-row ml-2"
      )}>
        <div className="hidden md:flex items-center gap-1 mr-1">
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { handleReact(emoji); setShowActions(false); }}
              className="w-11 h-11 rounded-full bg-card border border-border/60 flex items-center justify-center hover:bg-secondary hover:scale-125 hover:border-primary/40 transition-all shadow-sm text-sm"
              title={`React with ${emoji}`}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setShowEmojiPicker(!showEmojiPicker); }}
          className="w-11 h-11 rounded-full bg-card border border-border/60 flex items-center justify-center hover:bg-secondary hover:border-primary/30 transition-all shadow-sm"
          title="More reactions"
          aria-label="More reactions"
        >
          <Smile className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        
        {showEmojiPicker && (
          <EmojiReactionPicker
            position={isOwn ? "bottom" : "bottom"}
            onSelect={(emoji) => { handleReact(emoji); }}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        <button
          onClick={() => onReply?.(message)}
          className="w-11 h-11 rounded-full bg-card border border-border/60 flex items-center justify-center hover:bg-secondary hover:border-primary/30 transition-all shadow-sm"
          title="Reply"
          aria-label="Reply"
        >
          <Reply className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {canGoViral && (
          <button
            onClick={() => setViralOpen(true)}
            className="w-11 h-11 rounded-full bg-card border border-border/60 flex items-center justify-center hover:bg-primary/15 hover:border-primary/40 hover:text-primary transition-all shadow-sm"
            title="Create viral moment"
            aria-label="Create viral moment"
          >
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
          </button>
        )}

        {canUseAi && message.text && message.type === "text" && (
          <button
            onClick={() => speakText(message.text)}
            className="w-11 h-11 rounded-full bg-card border border-border/60 flex items-center justify-center hover:bg-primary/15 hover:border-primary/40 hover:text-primary transition-all shadow-sm"
            title="Read aloud"
            aria-label="Read aloud"
          >
            <Volume2 className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
          </button>
        )}

        {canShareVoiceCard && (
          <button
            onClick={() => setVoiceCardOpen(true)}
            className="w-11 h-11 rounded-full bg-card border border-border/60 flex items-center justify-center hover:bg-accent/15 hover:border-accent/40 hover:text-accent transition-all shadow-sm"
            title="Share voice card"
            aria-label="Share voice card"
          >
            <Share2 className="w-3.5 h-3.5 text-muted-foreground hover:text-accent" />
          </button>
        )}

        <button
          onClick={() => onOpenThread?.(message)}
          className="w-11 h-11 rounded-full bg-card border border-border/60 flex items-center justify-center hover:bg-secondary hover:border-primary/30 transition-all shadow-sm"
          title="Open thread"
          aria-label="Open thread"
        >
          <MessageSquareQuote className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {!isOwn && onStartDM && (
          <button
            onClick={async () => {
              const otherUser = users?.find(u => u.id === message.sender_id);
              if (!otherUser) return;
              try {
                await onStartDM(otherUser);
              } catch {}
            }}
            className="w-11 h-11 rounded-full bg-card border border-border/60 flex items-center justify-center hover:bg-secondary hover:border-primary/30 transition-all shadow-sm"
            title="Message privately"
            aria-label="Message privately"
          >
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}

        {isOwn && message.type === "text" && (
          <button
            onClick={() => onEdit?.(message)}
            className="w-11 h-11 rounded-full bg-card border border-border/60 flex items-center justify-center hover:bg-secondary hover:border-primary/30 hover:text-primary transition-all shadow-sm"
            title="Edit message"
            aria-label="Edit message"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
          </button>
        )}

        {(canDelete !== undefined ? canDelete : isOwn) && (
          <button
            onClick={() => onDelete?.(message.id)}
            className="w-11 h-11 rounded-full bg-card border border-border/60 flex items-center justify-center hover:bg-destructive/20 hover:border-destructive/30 hover:text-destructive transition-all shadow-sm"
            title="Delete message"
            aria-label="Delete message"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Media Viewer Modal */}
      <MediaViewer
        media={hasFile ? message : null}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        canDownload={canDownload}
      />

      <ViralMomentDialog
        message={message}
        isOpen={viralOpen}
        onClose={() => setViralOpen(false)}
      />

      <VoiceCardDialog
        message={message}
        isOpen={voiceCardOpen}
        onClose={() => setVoiceCardOpen(false)}
      />

      <MessageContextMenu
        position={contextMenuPos}
        onClose={() => setContextMenuPos(null)}
        items={[
          ...(canGoViral ? [{ icon: Sparkles, label: "Create Viral Moment", onClick: () => setViralOpen(true), highlight: true }] : []),
          ...(canShareVoiceCard ? [{ icon: Share2, label: "Share Voice Card", onClick: () => setVoiceCardOpen(true), highlight: true }] : []),
          { icon: Reply, label: "Reply", onClick: () => { if (navigator.vibrate) navigator.vibrate(20); onReply?.(message); } },
          { icon: MessageSquareQuote, label: "Open Thread", onClick: () => onOpenThread?.(message) },
          ...(message.text ? [{ icon: Copy, label: "Copy", onClick: () => onCopy?.(message) }] : []),
          ...(canUseAi && message.text ? [{ icon: Volume2, label: "Read Aloud", onClick: () => speakText(message.text) }] : []),
          ...(isOwn && message.type === "text" ? [{ icon: Pencil, label: "Edit", onClick: () => onEdit?.(message) }] : []),
          ...((canDelete !== undefined ? canDelete : isOwn) ? [{ icon: Trash2, label: "Delete", onClick: () => { if (navigator.vibrate) navigator.vibrate(40); onDelete?.(message.id); }, destructive: true }] : []),
          { icon: Flag, label: "Report", onClick: () => setReportOpen(true), destructive: true },
        ]}
      />

      <ReportContentDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="message"
        contentId={message.id}
        contentText={message.text || message.file_name || ""}
        conversationId={message.conversation_id}
      />
    </motion.div>
    </SwipeToReply>
  );
});