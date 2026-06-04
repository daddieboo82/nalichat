import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, ArrowLeft, Search as SearchIcon, Phone, Video, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import GroupInfoPanel from "./GroupInfoPanel";
import TypingIndicator from "./TypingIndicator";
import ThreadPanel from "./ThreadPanel";
import MessageSearch from "./MessageSearch";

export default function ChatView({ conversation, messages, currentUser, users, onSendMessage, onReact, onBack }) {
  const [replyTo, setReplyTo] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [threadMessage, setThreadMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchScrollTarget, setSearchScrollTarget] = useState(null);
  const scrollRef = useRef(null);
  const prevLenRef = useRef(0);
  const markedRef = useRef(new Set());
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const isNearBottom = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 200;
    if (isNearBottom || messages.length !== prevLenRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLenRef.current = messages.length;
  }, [messages]);

  // Mark incoming messages as read
  useEffect(() => {
    if (!currentUser || !messages.length) return;
    const unread = messages.filter(m =>
      m.sender_id !== currentUser.id &&
      !m.read_by?.includes(currentUser.id) &&
      !markedRef.current.has(m.id)
    );
    if (!unread.length) return;
    unread.forEach(m => markedRef.current.add(m.id));
    unread.forEach(m => {
      base44.entities.Message.update(m.id, {
        read_by: [...(m.read_by || []), currentUser.id]
      });
    });
  }, [messages, currentUser]);

  const getOtherUser = () => {
    if (conversation?.type === "group") return null;
    const otherId = conversation?.participant_ids?.find(id => id !== currentUser?.id);
    return users?.find(u => u.id === otherId);
  };

  const other = getOtherUser();
  const displayName = conversation?.type === "group"
    ? conversation.name
    : (other?.display_name || other?.full_name || "Unknown");
  const avatarSrc = conversation?.type === "group" ? conversation?.avatar_url : other?.avatar_url;
  const subtitle = conversation?.type === "group"
    ? `${conversation.participant_ids?.length || 0} members`
    : (other?.role ? other.role.charAt(0).toUpperCase() + other.role.slice(1) : "");

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground relative overflow-hidden" style={{ background: "hsl(240 10% 3.5%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>
        <div className="text-center relative z-10">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-pink-500/20 border border-primary/20 flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-primary/10">
            <MessageSquare className="w-11 h-11 text-primary/60" />
          </div>
          <p className="font-heading font-bold text-2xl mb-2">Your Messages</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">Select a conversation from the left, or start a new one to connect with artists</p>
        </div>
      </div>
    );
  }

  // Filter out thread replies — they show in the ThreadPanel only
  const topLevelMessages = messages.filter(m => !m.thread_id);

  // Group messages by sender for consecutive grouping
  const enriched = topLevelMessages.map((msg, i) => {
    const prev = topLevelMessages[i - 1];
    const showAvatar = !prev || prev.sender_id !== msg.sender_id;
    return { ...msg, showAvatar };
  });

  // Group by date
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
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "hsl(240 10% 3.5%)" }}>
      {/* Header */}
      <div className="h-16 border-b border-border/50 flex items-center px-3 sm:px-5 gap-2 sm:gap-3 shrink-0 backdrop-blur-xl" style={{ background: "hsl(240 10% 5% / 0.9)" }}>
        {/* Back button — mobile only */}
        <button onClick={onBack} className="sm:hidden w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0 touch-manipulation">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar className="w-10 h-10 shrink-0 shadow-lg">
          <AvatarImage src={avatarSrc} />
          <AvatarFallback className={cn("font-bold text-sm bg-gradient-to-br text-white", avatarGradient)}>
            {displayName?.[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-sm truncate">{displayName}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground/70 capitalize">{subtitle}</p>}
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:bg-secondary/60"
            onClick={() => setShowSearch(true)}
            title="Search"
          >
            <SearchIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:bg-secondary/60 hidden sm:flex"
            title="Voice call"
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:bg-secondary/60 hidden sm:flex"
            title="Video call"
          >
            <Video className="w-4 h-4" />
          </Button>
          {conversation?.type === "group" && (
            <button
              onClick={() => setShowGroupInfo(v => !v)}
              className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-all", showGroupInfo ? "bg-primary/20 text-primary shadow-sm" : "hover:bg-secondary/60 text-muted-foreground")}
              title="Group info"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-0.5">
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 opacity-30" />
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground/60">Be the first to say hello! 👋</p>
          </div>
        )}
        {groups.map((item, i) =>
          item.type === "date" ? (
            <div key={item.key} className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[10px] text-muted-foreground/50 font-medium px-3 py-1 rounded-full bg-secondary/30 border border-border/30">{item.label}</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
          ) : (
            <MessageBubble
              key={item.id}
              message={item}
              isOwn={item.sender_id === currentUser?.id}
              showAvatar={item.showAvatar}
              onReply={setReplyTo}
              onReact={onReact}
              onOpenThread={setThreadMessage}
              users={users}
              onCopy={() => navigator.clipboard.writeText(item.text || "")}
              onDelete={async (id) => {
                await base44.entities.Message.delete(id);
              }}
              currentUser={currentUser}
            />
          )
        )}
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-5 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
          <TypingIndicator />
          <span>{typingUsers.map(u => u.display_name || u.full_name).join(", ")} typing...</span>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onTyping={() => {
          // Simulate typing broadcast (in production, send via WebSocket)
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUsers([]);
          }, 2000);
        }}
      />
      </div>
      {showGroupInfo && conversation?.type === "group" && (
        <GroupInfoPanel
          conversation={conversation}
          users={users}
          currentUser={currentUser}
          onClose={() => setShowGroupInfo(false)}
        />
      )}
      {threadMessage && (
        <ThreadPanel
          parentMessage={threadMessage}
          currentUser={currentUser}
          onClose={() => setThreadMessage(null)}
        />
      )}
      {showSearch && (
        <MessageSearch
          messages={messages}
          onClose={() => setShowSearch(false)}
          onSelectMessage={(msg) => {
            setSearchScrollTarget(msg.id);
            scrollRef.current?.scrollIntoView?.({ behavior: "smooth" });
          }}
          users={users}
        />
      )}
    </div>
  );
}

function formatDateLabel(date) {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}