import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, ArrowLeft, ArrowDown, Search as SearchIcon, Phone, Video, Info, MoreHorizontal, Loader2 } from "lucide-react";
import MediaViewerModal from "@/components/explore/MediaViewerModal";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import GroupInfoPanel from "./GroupInfoPanel";
import TypingIndicator from "./TypingIndicator";
import ThreadPanel from "./ThreadPanel";
import MessageSearch from "./MessageSearch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { recordSquadActivity } from "@/lib/squadBonus";
import { queryClientInstance as queryClient } from "@/lib/query-client";
import NaliPresenceIndicator from "@/components/nali/NaliPresenceIndicator";
import NaliContextHint from "@/components/nali/NaliContextHint";
import { routeNativeCall } from "@/lib/nativeCall";
import { useCall, isCallSignal } from "@/hooks/useCall";
import CallOverlay from "./CallOverlay";
import { motion, AnimatePresence } from "framer-motion";

import React from "react";

const ADMIN_EMAILS = ["bossglop43@gmail.com"];

export default React.memo(function ChatView({ conversation, messages, isLoading, currentUser, users, onSendMessage, onEditMessage, onReact, onBack, onStartDM, isBlocked, moderationBanner }) {
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [threadMessage, setThreadMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadSinceScroll, setUnreadSinceScroll] = useState(0);
  const scrollRef = useRef(null);
  const prevLenRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const markedRef = useRef(new Set());
  const typingTimeoutRef = useRef(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // The keyboard can overlay the viewport without resizing it (iOS Safari/WebView,
  // older Android WebView) or resize it (Android Chrome 108+ with
  // interactive-widget=resizes-content). Track the visualViewport to lift the
  // input bar above the keyboard in both cases. The window resize listener
  // handles the Android race condition where innerHeight updates after VV.
  useEffect(() => {
    const vv = window.visualViewport;
    const onResize = () => {
      if (!vv) return;
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    if (vv) {
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
    }
    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      if (vv) {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      }
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const isNearBottom = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 200;
    isNearBottomRef.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);
    if (isNearBottom) setUnreadSinceScroll(0);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    isNearBottomRef.current = true;
    setShowScrollBottom(false);
    setUnreadSinceScroll(0);
  };

  // Auto-scroll to bottom only when already near bottom (Messenger pattern).
  // If the user is reading older messages, don't yank them down — just badge the FAB.
  useEffect(() => {
    if (!scrollRef.current) return;
    if (isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setUnreadSinceScroll(0);
    } else if (messages.length > prevLenRef.current) {
      setUnreadSinceScroll(c => c + (messages.length - prevLenRef.current));
    }
    prevLenRef.current = messages.length;
  }, [messages]);

  // Route a call to the device's native calling app when supported; fall back
  // to the in-app WebRTC engine when it isn't.
  const startCall = (type) => {
    const phoneNumber = other?.phone || other?.phone_number;
    const email = other?.email;
    const launchedNative = routeNativeCall({ type, phoneNumber, email });
    if (!launchedNative) {
      callActions.startCall(type);
    }
  };

  useEffect(() => {
    if (!currentUser || !messages.length) return;
    const unread = messages.filter(m => m.sender_id !== currentUser.id && !m.read_by?.includes(currentUser.id) && !markedRef.current.has(m.id));
    if (!unread.length) return;
    unread.forEach(m => markedRef.current.add(m.id));
    // Read receipts require updating another user's message, which RLS blocks.
    // Fire-and-forget — the 403 is expected and harmless; the UI still shows the message.
    unread.forEach(m => {
      base44.functions.invoke('markMessageRead', { message_id: m.id }).catch(() => {});
    });
  }, [messages, currentUser]);

  useEffect(() => {
    setReplyTo(null);
    setEditingMessage(null);
    setShowGroupInfo(false);
    setThreadMessage(null);
    setShowSearch(false);
  }, [conversation?.id]);

  const getOtherUser = () => {
    if (conversation?.type === "group") return null;
    const otherId = conversation?.participant_ids?.find(id => id !== currentUser?.id);
    return users?.find(u => u.id === otherId);
  };

  const other = getOtherUser();

  // --- WebRTC call engine (audio + video) ---
  const callActions = useCall({ conversation, messages, currentUser, otherUser: other });

  const displayName = conversation?.type === "group" ? conversation.name : (other?.display_name || other?.full_name || "Unknown");
  const avatarSrc = conversation?.type === "group" ? conversation?.avatar_url : other?.avatar_url;
  const subtitle = conversation?.type === "group" 
    ? `${conversation.participant_ids?.length || 0} members` 
    : (other?.is_online ? "Active now" : (other?.role ? other.role.charAt(0).toUpperCase() + other.role.slice(1) : "Offline"));

  const topLevelMessages = messages.filter(m => !m.thread_id && !isCallSignal(m.text));
  const enriched = topLevelMessages.map((msg, i) => {
    const prev = topLevelMessages[i - 1];
    const showAvatar = !prev || prev.sender_id !== msg.sender_id;
    return { ...msg, showAvatar };
  });

  // First unread message from the other person (for the "New Messages" separator)
  const firstUnreadId = (() => {
    for (const msg of enriched) {
      if (msg.sender_id !== currentUser?.id && !msg.read_by?.includes(currentUser?.id)) {
        return msg.id;
      }
    }
    return null;
  })();

  const groups = [];
  let lastDate = null;
  let unreadInserted = false;
  for (const msg of enriched) {
    const d = msg.created_date ? new Date(msg.created_date) : new Date();
    const dateStr = d.toDateString();
    if (dateStr !== lastDate) {
      groups.push({ type: "date", label: formatDateLabel(d), key: dateStr });
      lastDate = dateStr;
    }
    if (firstUnreadId === msg.id && !unreadInserted) {
      groups.push({ type: "unread", key: "unread-sep-" + msg.id });
      unreadInserted = true;
    }
    groups.push({ type: "msg", ...msg });
  }

  const gradients = ["from-primary to-pink-500","from-accent to-cyan-400","from-yellow-500 to-orange-500","from-green-400 to-emerald-600","from-purple-500 to-indigo-500"];
  const avatarGradient = gradients[(displayName?.charCodeAt(0) || 0) % gradients.length];

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-2 sm:p-4 pointer-events-none">
        <div className="h-16 bg-background/80 backdrop-blur-2xl border border-border/50 rounded-3xl flex items-center px-4 gap-3 shadow-xl pointer-events-auto transition-all">
          <button onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground bg-secondary/80 hover:bg-secondary transition-colors shrink-0" title="Go Back" aria-label="Go Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <Avatar className="w-10 h-10 shadow-md">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback className={cn("font-bold text-sm text-white bg-gradient-to-br", avatarGradient)}>
              {displayName?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => conversation?.type === "group" && setShowGroupInfo(true)}>
            <p className="font-heading font-semibold text-[15px] leading-tight truncate">{displayName}</p>
            <p className={cn("text-[11px] font-medium leading-tight truncate", other?.is_online ? "text-green-500" : "text-muted-foreground")}>{subtitle}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <NaliPresenceIndicator
              surface="chat"
              size="md"
              greeting={`Nali, I'm in a chat with ${displayName}. Read the vibe of our conversation and suggest a music idea, a playlist, or a creative prompt that fits.`}
            />
            <Button variant="ghost" size="icon" className="w-11 h-11 rounded-full text-muted-foreground hover:bg-secondary/80" onClick={() => setShowSearch(true)} title="Search Messages" aria-label="Search Messages">
              <SearchIcon className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-11 h-11 rounded-full text-muted-foreground hover:bg-secondary/80" title="More Options" aria-label="More Options">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-border/50 bg-background/95 backdrop-blur-xl">
                <DropdownMenuItem onClick={() => startCall('audio')} className="py-2.5 rounded-lg cursor-pointer" aria-label="Audio Call" title="Audio Call">
                  <Phone className="w-4 h-4 mr-2 text-muted-foreground" /> Audio Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => startCall('video')} className="py-2.5 rounded-lg cursor-pointer" aria-label="Video Call" title="Video Call">
                  <Video className="w-4 h-4 mr-2 text-muted-foreground" /> Video Call
                </DropdownMenuItem>
                {conversation?.type === "group" && (
                  <DropdownMenuItem onClick={() => setShowGroupInfo(true)} className="py-2.5 rounded-lg cursor-pointer text-primary focus:text-primary">
                    <Info className="w-4 h-4 mr-2" /> Group Info
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 pt-24 pb-4 space-y-0.5 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p>No messages yet. Say hi!</p>
          </div>
        ) : (
          groups.map((item, i) =>
          item.type === "date" ? (
            <div key={item.key} className="flex justify-center my-6 sticky top-24 z-10 pointer-events-none">
              <span className="text-[10px] text-muted-foreground font-semibold px-3 py-1 rounded-full bg-background/60 backdrop-blur-md border border-border/30 shadow-sm uppercase tracking-wider">
                {item.label}
              </span>
            </div>
          ) : item.type === "unread" ? (
            <div key={item.key} className="flex items-center justify-center my-3 gap-2">
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-[10px] font-bold text-primary px-2 uppercase tracking-wider bg-primary/10 rounded-full py-0.5 border border-primary/20">
                New Messages
              </span>
              <div className="h-px flex-1 bg-border/40" />
            </div>
          ) : (
            <MessageBubble
              key={item.id}
              message={item}
              isOwn={item.sender_id === currentUser?.id}
              canDelete={item.sender_id === currentUser?.id || currentUser?.role === 'admin' || ADMIN_EMAILS.includes(currentUser?.email) || currentUser?.role === 'producer'}
              showAvatar={item.showAvatar}
              onReply={(msg) => {
                setReplyTo(msg);
                setEditingMessage(null);
              }}
              onEdit={(msg) => {
                setEditingMessage(msg);
                setReplyTo(null);
              }}
              onReact={onReact}
              onOpenThread={setThreadMessage}
              users={users}
              onCopy={() => navigator.clipboard.writeText(item.text || "")}
              onDelete={async (id) => {
                if (editingMessage?.id === id) setEditingMessage(null);
                if (replyTo?.id === id) setReplyTo(null);
                // Instant optimistic delete: remove from the cache immediately so the
                // message vanishes from the UI with zero network delay.
                const previous = queryClient.getQueryData(["messages", conversation?.id]);
                queryClient.setQueryData(["messages", conversation?.id], (old = []) =>
                  old.filter(m => m.id !== id)
                );
                try {
                  await base44.entities.Message.delete(id);
                } catch (e) {
                  // Restore the message if the server delete failed.
                  if (previous) queryClient.setQueryData(["messages", conversation?.id], previous);
                }
              }}
              currentUser={currentUser}
              onStartDM={onStartDM}
              onPlayAudio={(msg) => {
                setSelectedMedia({
                  id: msg.id,
                  title: msg.file_name || "Audio message",
                  file_url: msg.file_url,
                  creator_name: msg.sender_name,
                  creator_avatar: msg.sender_avatar
                });
              }}
            />
          )
        ))}
      </div>

      {/* Scroll-to-bottom FAB (Messenger pattern) */}
      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-32 right-6 z-20 w-11 h-11 rounded-full bg-card border border-border/60 shadow-2xl flex items-center justify-center hover:bg-secondary/80 transition-colors"
            title="Scroll to latest"
            aria-label="Scroll to latest"
          >
            <ArrowDown className="w-5 h-5 text-primary" />
            {unreadSinceScroll > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadSinceScroll > 9 ? '9+' : unreadSinceScroll}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="absolute bottom-24 left-6 z-10 px-4 py-2 text-[11px] font-medium text-muted-foreground bg-background/80 backdrop-blur-md rounded-full border border-border/50 shadow-sm flex items-center gap-2">
          <TypingIndicator />
          <span>{typingUsers.map(u => u.display_name || u.full_name).join(", ")} typing</span>
        </div>
      )}

      {/* Proactive Nali context hint — subtle, dismissible, respects presence level */}
      <div className="absolute bottom-24 right-6 z-10">
        <NaliContextHint surface="chat" contextLabel={conversation?.id || "chat"} />
      </div>

      {/* Input Area — flex child so it always sits at the bottom of the column */}
      <div className="shrink-0 z-20 p-2 sm:p-4" style={{ marginBottom: `${keyboardOffset}px` }}>
        {isBlocked ? moderationBanner : (
        <div className="w-full max-w-4xl mx-auto shadow-2xl rounded-3xl overflow-visible bg-background/90 backdrop-blur-2xl border border-border/50">
          <ChatInput
            key={conversation?.id || "chat"}
            onSend={(payload) => {
              if (editingMessage && payload.type === 'text') {
                onEditMessage(editingMessage.id, payload.text);
                setEditingMessage(null);
              } else {
                onSendMessage(payload);
                if (currentUser) recordSquadActivity(currentUser.id, "message");
              }
            }}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
            onTyping={() => {
              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => setTypingUsers([]), 2000);
            }}
          />
        </div>
        )}
      </div>

      {/* Panels */}
      {showGroupInfo && conversation?.type === "group" && (
        <GroupInfoPanel conversation={conversation} users={users} currentUser={currentUser} onClose={() => setShowGroupInfo(false)} onStartDM={onStartDM} />
      )}
      {threadMessage && (
        <ThreadPanel parentMessage={threadMessage} currentUser={currentUser} onClose={() => setThreadMessage(null)} />
      )}
      {showSearch && (
        <MessageSearch
          messages={messages}
          onClose={() => setShowSearch(false)}
          onSelectMessage={(msg) => {
            const el = document.getElementById(`message-${msg.id}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("bg-primary/20", "rounded-xl", "transition-colors");
              setTimeout(() => el.classList.remove("bg-primary/20", "rounded-xl"), 2000);
            }
          }}
          users={users}
        />
      )}

      {selectedMedia && (
        <MediaViewerModal
          post={selectedMedia}
          open={!!selectedMedia}
          onOpenChange={(isOpen) => !isOpen && setSelectedMedia(null)}
        />
      )}

      {/* WebRTC Call Overlay — real audio/video engine */}
      <CallOverlay
        callState={callActions.callState}
        localStream={callActions.localStream}
        remoteStream={callActions.remoteStream}
        displayName={displayName}
        avatarSrc={avatarSrc}
        avatarGradient={avatarGradient}
        muted={callActions.muted}
        videoEnabled={callActions.videoEnabled}
        onAccept={callActions.acceptCall}
        onDecline={callActions.declineCall}
        onEnd={callActions.endCall}
        onToggleMute={callActions.toggleMute}
        onToggleVideo={callActions.toggleVideo}
      />
    </div>
  );
});

function formatDateLabel(date) {
  if (isNaN(date.getTime())) return "Unknown Date";
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}