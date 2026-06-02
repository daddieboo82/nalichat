import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function ConversationList({ conversations, selectedId, onSelect, onNewChat, users, currentUserId }) {
  const getOtherUser = (conv) => {
    if (conv.type === "group") return null;
    const otherId = conv.participant_ids?.find(id => id !== currentUserId);
    return users?.find(u => u.id === otherId);
  };

  return (
    <div className="w-80 border-r border-border flex flex-col bg-card/50 shrink-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold">Messages</h2>
          <Button size="icon" variant="ghost" onClick={onNewChat} className="rounded-xl hover:bg-primary/20 hover:text-primary">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search conversations..." className="pl-9 bg-secondary/50 border-0 rounded-xl" />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-6">
            <MessageSquare className="w-10 h-10 opacity-30" />
            <p className="text-sm text-center">No conversations yet.<br/>Start connecting!</p>
          </div>
        ) : (
          conversations.map(conv => {
            const other = getOtherUser(conv);
            const displayName = conv.type === "group" ? conv.name : (other?.display_name || other?.full_name || "Unknown");
            const avatar = conv.type === "group" ? conv.avatar_url : other?.avatar_url;
            
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left",
                  selectedId === conv.id && "bg-primary/10 border-l-2 border-primary"
                )}
              >
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={avatar} />
                  <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                    {displayName?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm truncate">{displayName}</p>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.last_message_text || "No messages yet"}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}