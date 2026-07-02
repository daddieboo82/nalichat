import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, ArrowLeft, Search as SearchIcon, Phone, Video, Info, MoreHorizontal, Loader2 } from "lucide-react";
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

import React from "react";

const ADMIN_EMAILS = ["bossglop43@gmail.com"];

export default React.memo(function ChatView({ conversation, messages, isLoading, currentUser, users, onSendMessage, onEditMessage, onReact, onBack, onStartDM, isBlocked, moderationBanner }) {
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [threadMessage, setThreadMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [callState, setCallState] = useState(null);
  const scrollRef = useRef(null);
  const prevLenRef = useRef(0);
  const markedRef = useRef(new Set());
  const typingTimeoutRef = useRef(null);
  const [selectedMedia, setSelectedMedia] = useState(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const isNearBottom = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 200;
    if (isNearBottom || messages.length !== prevLenRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLenRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (!currentUser || !messages.length) return;
    const unread = messages.filter(m => m.sender_id !== currentUser.id && !m.read_by?.includes(currentUser.id) && !markedRef.current.has(m.id));
    if (!unread.length) return;
    unread.forEach(m => markedRef.current.add(m.id));
    unread.forEach(m => base44.entities.Message.update(m.id, { read_by: [...(m.read_by || []), currentUser.id] }));
  }, [messages, currentUser]);

  useEffect(() => {
    setReplyTo(null);
    setEditingMessage(null);
    setShowGroupInfo(false);
    setThreadMessage(null);
    setShowSearch(false);
    setCallState(null);
  }, [conversation?.id]);

  const getOtherUser = () => {
    if (conversation?.type === "group") return null;
    const otherId = conversation?.participant_ids?.find(id => id !== currentUser?.id);
    return users?.find(u => u.id === otherId);
  };

  const other = getOtherUser();
  const displayName = conversation?.type === "group" ? conversation.name : (other?.display_name || other?.full_name || "Unknown");
  const avatarSrc = conversation?.type === "group" ? conversation?.avatar_url : other?.avatar_url;
  const subtitle = conversation?.type === "group" 
    ? `${conversation.participant_ids?.length || 0} members` 
    : (other?.is_online ? "Active now" : (other?.role ? other.role.charAt(0).toUpperCase() + other.role.slice(1) : "Offline"));

  const topLevelMessages = messages.filter(m => !m.thread_id);
  const enriched = topLevelMessages.map((msg, i) => {
    const prev = topLevelMessages[i - 1];
    const showAvatar = !prev || prev.sender_id !== msg.sender_id;
    return { ...msg, showAvatar };
  });

  const groups = [];
  let lastDate = null;
  for (const msg of enriched) {
    const d = msg.created_date ? new Date(msg.created_date) : new Date();
    const dateStr = d.toDateString();
    if (dateStr !== lastDate) {
      groups.push({ type: "date", label: formatDateLabel(d), key: dateStr });
      lastDate = dateStr;
    }
    groups.push({ type: "msg", ...msg });
  }

  const gradients = ["from-primary to-pink-500","from-accent to-cyan-400","from-yellow-500 to-orange-500","from-green-400 to-emerald-600","from-purple-500 to-indigo-500"];
  const avatarGradient = gradients[(displayName?.charCodeAt(0) || 0) % gradients.length];

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-2 sm:p-4 pointer-events-none">
        <div className="h-16 bg-background/80 backdrop-blur-2xl border border-border/50 rounded-3xl flex items-center px-4 gap-3 shadow-xl pointer-events-auto transition-all">
          <button onClick={onBack} className="sm:hidden w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground bg-secondary/80 hover:bg-secondary transition-colors shrink-0" title="Go Back" aria-label="Go Back">
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
                <DropdownMenuItem onClick={() => setCallState({ type: 'audio' })} className="py-2.5 rounded-lg cursor-pointer" aria-label="Audio Call" title="Audio Call">
                  <Phone className="w-4 h-4 mr-2 text-muted-foreground" /> Audio Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCallState({ type: 'video' })} className="py-2.5 rounded-lg cursor-pointer" aria-label="Video Call" title="Video Call">
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 pt-24 pb-32 space-y-0.5 custom-scrollbar">
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
                await base44.entities.Message.delete(id);
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

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="absolute bottom-24 left-6 z-10 px-4 py-2 text-[11px] font-medium text-muted-foreground bg-background/80 backdrop-blur-md rounded-full border border-border/50 shadow-sm flex items-center gap-2">
          <TypingIndicator />
          <span>{typingUsers.map(u => u.display_name || u.full_name).join(", ")} typing</span>
        </div>
      )}

      {/* Floating Input Area */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-2 sm:p-4 flex flex-col justify-end">
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

      {/* Call UI Overlay */}
      {callState && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-200">
          <Avatar className="w-32 h-32 mb-6 shadow-2xl ring-4 ring-primary/20">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback className={cn("text-4xl text-white font-bold bg-gradient-to-br", avatarGradient)}>
              {displayName?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          
          <h2 className="text-3xl font-heading font-bold mb-2">{displayName}</h2>
          <p className="text-muted-foreground mb-12 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {callState.type === 'video' ? 'Starting video call...' : 'Calling...'}
          </p>
          
          <div className="flex items-center gap-6">
            {callState.type === 'video' && (
              <Button size="icon" variant="outline" className="w-14 h-14 rounded-full bg-secondary/50 border-white/10 hover:bg-secondary" title="Enable/Disable Video" aria-label="Enable/Disable Video">
                <Video className="w-6 h-6" />
              </Button>
            )}
            <Button 
              size="icon" 
              variant="destructive" 
              className="w-16 h-16 rounded-full shadow-lg shadow-destructive/20 hover:scale-105 transition-transform"
              onClick={() => setCallState(null)}
              title="End Call"
              aria-label="End Call"
            >
              <Phone className="w-7 h-7 rotate-[135deg]" />
            </Button>
          </div>
        </div>
      )}
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