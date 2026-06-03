import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Plus, MessageSquare, Users, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ConversationList({ conversations, selectedId, onSelect, onNewDM, onNewGroup, users, currentUserId }) {
  const [search, setSearch] = useState("");

  const getOtherUser = (conv) => {
    if (conv.type === "group") return null;
    const otherId = conv.participant_ids?.find(id => id !== currentUserId);
    return users?.find(u => u.id === otherId);
  };

  const filtered = conversations.filter(conv => {
    const other = getOtherUser(conv);
    const name = conv.type === "group" ? conv.name : (other?.display_name || other?.full_name || "");
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="w-full sm:w-[300px] border-r border-border flex flex-col bg-card/40 backdrop-blur-sm shrink-0">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold">Messages</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onNewDM} className="gap-2 cursor-pointer">
                <MessageSquare className="w-4 h-4" /> New Message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewGroup} className="gap-2 cursor-pointer">
                <Users className="w-4 h-4" /> New Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-9 bg-secondary/50 border-0 rounded-xl h-9 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-6">
            <MessageSquare className="w-8 h-8 opacity-20" />
            <p className="text-xs text-center">{search ? "No results" : "No conversations yet.\nTap + to start one!"}</p>
          </div>
        ) : (
          filtered.map(conv => {
            const other = getOtherUser(conv);
            const displayName = conv.type === "group" ? conv.name : (other?.display_name || other?.full_name || "Unknown");
            const avatar = conv.type === "group" ? conv.avatar_url : other?.avatar_url;
            const isSelected = selectedId === conv.id;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 mx-1 rounded-xl transition-colors text-left",
                  "hover:bg-secondary/60",
                  isSelected && "bg-primary/10 hover:bg-primary/15"
                )}
                style={{ width: "calc(100% - 8px)" }}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-11 h-11">
                    <AvatarImage src={avatar} />
                    <AvatarFallback className={cn("font-bold text-sm", isSelected ? "bg-primary/30 text-primary" : "bg-secondary text-muted-foreground")}>
                      {displayName?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  {conv.type === "group" && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-accent rounded-full flex items-center justify-center border-2 border-card">
                      <Users className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <p className={cn("text-sm font-semibold truncate", isSelected && "text-primary")}>{displayName}</p>
                    {conv.last_message_at && (
                      <span className="text-[9px] text-muted-foreground shrink-0 ml-1">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.last_message_text || <span className="italic">No messages yet</span>}
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