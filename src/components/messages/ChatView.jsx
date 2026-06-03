import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Users, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import GroupInfoPanel from "./GroupInfoPanel";
import TypingIndicator from "./TypingIndicator";
import ThreadPanel from "./ThreadPanel";

export default function ChatView({ conversation, messages, currentUser, users, onSendMessage, onReact, onBack }) {
  const [replyTo, setReplyTo] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [threadMessage, setThreadMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
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
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-background/50">
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <MessageSquare className="w-10 h-10 text-primary/40" />
          </div>
          <p className="font-heading font-bold text-xl mb-2">Your Messages</p>
          <p className="text-sm text-muted-foreground">Select a conversation or start a new one</p>
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
    const dateStr = new Date(msg.created_date).toDateString();
    if (dateStr !== lastDate) {
      groups.push({ type: "date", label: formatDateLabel(new Date(msg.created_date)), key: dateStr });
      lastDate = dateStr;
    }
    groups.push({ type: "msg", ...msg });
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center px-3 sm:px-5 gap-2 sm:gap-3 shrink-0 bg-card/70 backdrop-blur-sm">
        {/* Back button — mobile only */}
        <button onClick={onBack} className="sm:hidden w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0 touch-manipulation">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar className="w-9 h-9 shrink-0">
          <AvatarImage src={avatarSrc} />
          <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
            {displayName?.[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-sm truncate">{displayName}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground capitalize">{subtitle}</p>}
        </div>
        {conversation?.type === "group" && (
          <button
            onClick={() => setShowGroupInfo(v => !v)}
            className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-colors", showGroupInfo ? "bg-primary/20 text-primary" : "hover:bg-secondary text-muted-foreground")}
            title="Group info"
          >
            <Users className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <p className="text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}
        {groups.map((item, i) =>
          item.type === "date" ? (
            <div key={item.key} className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground font-medium px-2">{item.label}</span>
              <div className="flex-1 h-px bg-border" />
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