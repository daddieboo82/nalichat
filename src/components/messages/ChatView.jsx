import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";

export default function ChatView({ conversation, messages, currentUser, users, onSendMessage, onReact }) {
  const [replyTo, setReplyTo] = useState(null);
  const scrollRef = useRef(null);
  const prevLenRef = useRef(0);

  useEffect(() => {
    if (!scrollRef.current) return;
    const isNearBottom = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 200;
    if (isNearBottom || messages.length !== prevLenRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLenRef.current = messages.length;
  }, [messages]);

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

  // Group messages by sender for consecutive grouping
  const enriched = messages.map((msg, i) => {
    const prev = messages[i - 1];
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center px-5 gap-3 shrink-0 bg-card/70 backdrop-blur-sm">
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
            />
          )
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
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