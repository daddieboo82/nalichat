import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Send, MessageSquareQuote } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { createClientMessageKey } from "@/lib/messageCache";
import { toast } from "sonner";

function ThreadMessage({ msg, isOwn }) {
  return (
    <div className={cn("flex gap-2 mb-3", isOwn ? "flex-row-reverse" : "flex-row")}>
      <Avatar className="w-6 h-6 shrink-0 mt-0.5">
        <AvatarImage src={msg.sender_avatar} />
        <AvatarFallback className="bg-primary/20 text-primary text-[9px] font-bold">
          {msg.sender_name?.[0]?.toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      <div className={cn("max-w-[80%] flex flex-col", isOwn && "items-end")}>
        <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">{msg.sender_name}</p>
        <div className={cn(
          "rounded-xl px-3 py-2 text-sm",
          isOwn
            ? "bg-gradient-to-br from-primary to-pink-500 text-primary-foreground"
            : "bg-card border border-border"
        )}>
          {msg.text}
        </div>
        <p className="text-[9px] text-muted-foreground mt-0.5">
          {msg.created_date && !isNaN(new Date(msg.created_date).getTime()) ? format(new Date(msg.created_date), "h:mm a") : "..."}
        </p>
      </div>
    </div>
  );
}

export default function ThreadPanel({ parentMessage, currentUser, onClose }) {
  const [text, setText] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: replies = [] } = useQuery({
    queryKey: ["thread", parentMessage.id],
    queryFn: () => base44.entities.Message.filter({ thread_id: parentMessage.id }, "created_date"),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + "px";
    }
  }, [text]);

  const sendMutation = useMutation({
    mutationFn: async (msgText) => {
      const response = await base44.functions.invoke("sendMessage", {
        conversation_id: parentMessage.conversation_id,
        client_message_key: createClientMessageKey(),
        message: {
          text: msgText,
          type: "text",
          thread_id: parentMessage.id,
        },
      });
      if (response.data?.rejection?.type === "moderation") {
        throw new Error("This reply was blocked by moderation.");
      }
      const reply = response.data?.message;
      if (!reply) throw new Error("The reply service returned no message.");
      return reply;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", parentMessage.id] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (error) => {
      toast.error(error?.message || "Reply not sent. Please try again.");
    },
  });

  const handleSend = () => {
    if (!text.trim()) return;
    sendMutation.mutate(text.trim());
    setText("");
  };

  return (
    <div className="w-80 border-l border-border flex flex-col bg-card/70 backdrop-blur-sm shrink-0">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="w-4 h-4 text-primary" />
          <span className="font-heading font-semibold text-sm">Thread</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors" title="Close Thread" aria-label="Close Thread">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-start gap-2">
          <Avatar className="w-6 h-6 shrink-0">
            <AvatarImage src={parentMessage.sender_avatar} />
            <AvatarFallback className="bg-primary/20 text-primary text-[9px] font-bold">
              {parentMessage.sender_name?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">{parentMessage.sender_name}</p>
            <p className="text-sm text-foreground">{parentMessage.text || `[${parentMessage.type}]`}</p>
            <p className="text-[9px] text-muted-foreground mt-1">
              {parentMessage.created_date && !isNaN(new Date(parentMessage.created_date).getTime()) ? format(new Date(parentMessage.created_date), "MMM d, h:mm a") : "..."}
            </p>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {replies.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <MessageSquareQuote className="w-8 h-8 opacity-30 mx-auto mb-2" />
            <p className="text-xs">No replies yet. Start the thread!</p>
          </div>
        ) : (
          replies.map(msg => (
            <ThreadMessage key={msg.id} msg={msg} isOwn={msg.sender_id === currentUser?.id} />
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Reply in thread..."
            className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm resize-none min-h-[36px] max-h-[100px] focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="w-11 h-11 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
            title="Send Reply"
            aria-label="Send Reply"
          >
            <Send className="w-3.5 h-3.5 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}