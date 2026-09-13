import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, ArrowLeft, ArrowDown, Search as SearchIcon, Phone, Video, Info, MoreHorizontal, Loader2, LockKeyhole, LockOpen } from "lucide-react";
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
import { queryClientInstance as queryClient } from "@/lib/query-client";
import NaliPresenceIndicator from "@/components/nali/NaliPresenceIndicator";
import NaliContextHint from "@/components/nali/NaliContextHint";
import { routeNativeCall } from "@/lib/nativeCall";
import { copyToClipboard } from "@/lib/clipboard";
import { useCall, isCallSignal } from "@/hooks/useCall";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import CallOverlay from "./CallOverlay";
import { motion, AnimatePresence } from "framer-motion";
import { getChatTheme } from "@/lib/chatThemes";
import { toast } from "sonner";
import { useLockedChats } from "@/lib/LockedChatsContext";

import React from "react";

function updateMessageHistory(cache, updater) {
  if (Array.isArray(cache)) return updater(cache);
  const current = cache && typeof cache === "object"
    ? cache
    : { messages: [], hasOlder: false };
  return {
    ...current,
    messages: updater(Array.isArray(current.messages) ? current.messages : []),
  };
}

export default React.memo(function ChatView({ conversation, messages, isLoading, loadError, hasOlderMessages, isLoadingOlderMessages, onLoadOlderMessages, currentUser, users, onSendMessage, onEditMessage, onReact, onRetryMessage, onBack, onStartDM, isBlocked, moderationBanner, theme: themePreference, initialComposeText = "", onInitialComposeConsumed }) {
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [threadMessage, setThreadMessage] = useState(null);
  const [threadTargetId, setThreadTargetId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadSinceScroll, setUnreadSinceScroll] = useState(0);
  const scrollRef = useRef(null);
  const prevLenRef = useRef(0);
  const prevLatestIdRef = useRef(null);
  const historyAnchorRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const markedRef = useRef(new Set());
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const theme = getChatTheme(themePreference?.id);
  const {
    security: lockedChatSecurity,
    isEntitled: canConfigureLockedChats,
    isConversationLocked,
    updateConversationLock,
  } = useLockedChats();
  const conversationIsLocked = !!conversation?.id && isConversationLocked(conversation.id);
  const [updatingLock, setUpdatingLock] = useState(false);

  const toggleConversationLock = async () => {
    if (!conversation?.id || updatingLock) return;
    if (!canConfigureLockedChats) {
      toast.error("Premium Plus is required to change locked chats.");
      return;
    }
    if (!conversationIsLocked && !lockedChatSecurity?.configured) {
      toast.error("Set up your locked-chat PIN in Settings before locking a chat.");
      return;
    }
    setUpdatingLock(true);
    try {
      await updateConversationLock(conversation.id, !conversationIsLocked);
      toast.success(conversationIsLocked ? "Chat unlocked." : "Chat locked.");
    } catch (error) {
      toast.error(error?.message || "Couldn't update the chat lock. Please try again.");
    } finally {
      setUpdatingLock(false);
    }
  };

  // Real typing presence: broadcasts our own keystrokes (throttled) and reports
  // which other participants are currently typing.
  const { typingUsers, notifyTyping } = useTypingIndicator(
    conversation?.id,
    currentUser,
    conversation?.participant_ids || []
  );

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

  const loadOlderMessages = () => {
    if (!scrollRef.current || isLoadingOlderMessages) return;
    historyAnchorRef.current = {
      height: scrollRef.current.scrollHeight,
      top: scrollRef.current.scrollTop,
    };
    onLoadOlderMessages?.();
  };

  // Auto-scroll to bottom only when already near bottom (Messenger pattern).
  // If the user is reading older messages, don't yank them down — just badge the FAB.
  useEffect(() => {
    if (!scrollRef.current) return;
    const latestId = messages[messages.length - 1]?.id || null;
    if (isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setUnreadSinceScroll(0);
    } else if (
      messages.length > prevLenRef.current
      && prevLatestIdRef.current
      && latestId !== prevLatestIdRef.current
    ) {
      setUnreadSinceScroll(c => c + (messages.length - prevLenRef.current));
    }
    prevLenRef.current = messages.length;
    prevLatestIdRef.current = latestId;

    if (historyAnchorRef.current) {
      const { height, top } = historyAnchorRef.current;
      const addedHeight = scrollRef.current.scrollHeight - height;
      scrollRef.current.scrollTop = top + Math.max(0, addedHeight);
      historyAnchorRef.current = null;
    }
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
    // Read receipts require a server-side mutation. Track successful/in-flight
    // attempts locally, but release the marker on failure so polling can retry.
    unread.forEach(m => {
      markedRef.current.add(m.id);
      base44.functions.invoke('markMessageRead', { message_id: m.id })
        .then((res) => {
          if (res?.data?.error) {
            markedRef.current.delete(m.id);
          }
        })
        .catch(() => {
          markedRef.current.delete(m.id);
        });
    });
  }, [messages, currentUser]);

  useEffect(() => {
    markedRef.current.clear();
    setReplyTo(null);
    setEditingMessage(null);
    setShowGroupInfo(false);
    setThreadMessage(null);
    setThreadTargetId(null);
    setShowSearch(false);
  }, [conversation?.id]);

  const revealSearchResult = async (message) => {
    if (message.thread_id) {
      const parent = messages.find((candidate) => candidate.id === message.thread_id)
        || await base44.entities.Message.get(message.thread_id);
      if (!parent) throw new Error("Thread parent is unavailable.");
      setThreadTargetId(message.id);
      setThreadMessage(parent);
      return;
    }

    if (!messages.some((candidate) => candidate.id === message.id)) {
      queryClient.setQueryData(["messages", currentUser?.id, conversation?.id], (current) => updateMessageHistory(current, (rows) =>
        [...rows, message].sort(
          (left, right) => new Date(left.created_date || 0) - new Date(right.created_date || 0),
        )
      ));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }

    const element = document.getElementById(`message-${message.id}`);
    if (!element) throw new Error("Message is not available in this conversation.");
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("bg-primary/20", "rounded-xl", "transition-colors");
    window.setTimeout(
      () => element.classList.remove("bg-primary/20", "rounded-xl"),
      2000,
    );
  };

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
    <div className={cn("chat-theme flex-1 flex flex-col overflow-hidden relative min-h-0", theme.className)} data-chat-theme={theme.id}>
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-2 sm:p-4 pointer-events-none">
        <div className="chat-theme-header h-16 bg-background/80 backdrop-blur-2xl border border-border/50 rounded-3xl flex items-center px-4 gap-3 shadow-xl pointer-events-auto transition-all">
          <button onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground bg-secondary/80 hover:bg-secondary transition-colors shrink-0" title="Go Back" aria-label="Go Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="relative shrink-0">
            <Avatar className="w-10 h-10 shadow-md">
              <AvatarImage src={avatarSrc} />
              <AvatarFallback className={cn("font-bold text-sm text-white bg-gradient-to-br", avatarGradient)}>
                {displayName?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            {conversation?.type !== "group" && other?.is_online && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-[2.5px] border-background shadow-sm" aria-label="Active now" />
            )}
          </div>
          
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
                <DropdownMenuItem
                  onClick={toggleConversationLock}
                  disabled={updatingLock}
                  className="py-2.5 rounded-lg cursor-pointer"
                >
                  {conversationIsLocked
                    ? <LockOpen className="w-4 h-4 mr-2 text-muted-foreground" />
                    : <LockKeyhole className="w-4 h-4 mr-2 text-muted-foreground" />}
                  {updatingLock ? "Updating..." : conversationIsLocked ? "Unlock chat" : "Lock chat"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} onScroll={handleScroll} className="chat-theme-messages flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 pt-24 pb-4 space-y-0.5 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive" role="alert">
            Couldn't load messages. Please try again.
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p>No messages yet. Say hi!</p>
          </div>
        ) : (
          <>
            {hasOlderMessages && (
              <div className="flex justify-center pb-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={loadOlderMessages}
                  disabled={isLoadingOlderMessages}
                  className="rounded-full px-4"
                >
                  {isLoadingOlderMessages ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Load older messages
                </Button>
              </div>
            )}
            {groups.map((item, i) =>
          item.type === "date" ? (
            <div key={item.key} className="flex justify-center my-6 sticky top-24 z-10 pointer-events-none">
              <span className="chat-theme-chip text-[10px] text-muted-foreground font-semibold px-3 py-1 rounded-full bg-background/60 backdrop-blur-md border border-border/30 shadow-sm uppercase tracking-wider">
                {item.label}
              </span>
            </div>
          ) : item.type === "unread" ? (
            <div key={item.key} className="flex items-center justify-center my-3 gap-2">
              <div className="h-px flex-1 bg-border/40" />
              <span className="chat-theme-unread text-[10px] font-bold text-primary px-2 uppercase tracking-wider bg-primary/10 rounded-full py-0.5 border border-primary/20">
                New Messages
              </span>
              <div className="h-px flex-1 bg-border/40" />
            </div>
          ) : (
            <MessageBubble
              key={item.id}
              message={item}
              isOwn={item.sender_id === currentUser?.id}
              canDelete={item.sender_id === currentUser?.id || currentUser?.role === 'admin'}
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
              onRetry={onRetryMessage}
              onOpenThread={(message) => { setThreadTargetId(null); setThreadMessage(message); }}
              users={users}
              senderIsOnline={!!users?.find((user) => user.id === item.sender_id)?.is_online}
              onCopy={() => copyToClipboard(item.text || "")}
              onDelete={async (id) => {
                const previousEditingMessage = editingMessage;
                const previousReplyTo = replyTo;
                if (editingMessage?.id === id) setEditingMessage(null);
                if (replyTo?.id === id) setReplyTo(null);
                // Instant optimistic delete: remove from the cache immediately so the
                // message vanishes from the UI with zero network delay.
                const previous = queryClient.getQueryData(["messages", currentUser?.id, conversation?.id]);
                queryClient.setQueryData(["messages", currentUser?.id, conversation?.id], (old) => updateMessageHistory(old, (rows) => rows.filter(m => m.id !== id))
                );
                try {
                  let res = await base44.functions.invoke("mutateConversationMessage", {
                    action: "delete",
                    message_id: id,
                    conversation_id: conversation?.id,
                  });
                  if (res?.data?.error) throw new Error(res.data.error);
                  if (res?.data?.preview_refresh_failed) {
                    res = await base44.functions.invoke("mutateConversationMessage", {
                      action: "delete",
                      message_id: id,
                      conversation_id: conversation?.id,
                    });
                    if (res?.data?.error) throw new Error(res.data.error);
                  }
                } catch (e) {
                  // Restore the message and any composer context if the server delete failed.
                  if (previous) queryClient.setQueryData(["messages", currentUser?.id, conversation?.id], previous);
                  if (previousEditingMessage?.id === id) setEditingMessage(previousEditingMessage);
                  if (previousReplyTo?.id === id) setReplyTo(previousReplyTo);
                  toast.error("Couldn't delete the message. Please try again.");
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
          </>
        )}
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
          <span>{typingUsers.map(u => u.display_name).filter(Boolean).join(", ")} typing</span>
        </div>
      )}

      {/* Proactive Nali context hint — subtle, dismissible, respects presence level */}
      <div className="absolute bottom-24 right-6 z-10">
        <NaliContextHint surface="chat" contextLabel={conversation?.id || "chat"} />
      </div>

      {/* Input Area — flex child so it always sits at the bottom of the column */}
      <div className="shrink-0 z-20 p-2 sm:p-4" style={{ marginBottom: `${keyboardOffset}px` }}>
        {isBlocked ? moderationBanner : (
        <div className="chat-theme-composer w-full max-w-4xl mx-auto shadow-2xl rounded-3xl overflow-visible bg-background/90 backdrop-blur-2xl border border-border/50">
          <ChatInput
        initialText={initialComposeText}
        onInitialTextConsumed={onInitialComposeConsumed}
            key={conversation?.id || "chat"}
            onSend={(payload) => {
              if (editingMessage && payload.type === 'text') {
                return onEditMessage(editingMessage.id, payload.text);
              }
              return onSendMessage(payload);
            }}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
            onTyping={notifyTyping}
          />
        </div>
        )}
      </div>

      {/* Panels */}
      {showGroupInfo && conversation?.type === "group" && (
        <GroupInfoPanel conversation={conversation} users={users} currentUser={currentUser} onClose={() => setShowGroupInfo(false)} onStartDM={onStartDM} />
      )}
      {threadMessage && (
        <ThreadPanel
          parentMessage={threadMessage}
          currentUser={currentUser}
          targetMessageId={threadTargetId}
          onClose={() => {
            setThreadMessage(null);
            setThreadTargetId(null);
          }}
        />
      )}
      {showSearch && (
        <MessageSearch
          conversation={conversation}
          onClose={() => setShowSearch(false)}
          onSelectMessage={revealSearchResult}
          users={users}
        />
      )}

      {selectedMedia && (
        <MediaViewerModal
          post={selectedMedia}
          open={!!selectedMedia}
          onOpenChange={(isOpen) => !isOpen && setSelectedMedia(null)}
          currentUser={currentUser}
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