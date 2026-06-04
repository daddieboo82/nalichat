import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Plus, MessageSquare, Users, Mail, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { base44 } from "@/api/base44Client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ConversationList({ conversations, selectedId, onSelect, onNewDM, onNewGroup, onNewExternal, users, currentUserId }) {
  const [search, setSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});

  // Calculate unread counts for each conversation
  useEffect(() => {
    const calculateUnread = async () => {
      const counts = {};
      for (const conv of conversations) {
        const msgs = await base44.entities.Message.filter({ conversation_id: conv.id });
        counts[conv.id] = msgs.filter(m => 
          m.sender_id !== currentUserId && !m.read_by?.includes(currentUserId)
        ).length;
      }
      setUnreadCounts(counts);
    };
    if (conversations.length > 0) calculateUnread();
  }, [conversations, currentUserId]);

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

  // Gradient avatars for users without photos
  const gradients = [
    "from-primary to-pink-500",
    "from-accent to-cyan-400",
    "from-yellow-500 to-orange-500",
    "from-green-400 to-emerald-600",
    "from-purple-500 to-indigo-500",
    "from-rose-500 to-pink-500",
  ];
  const getGradient = (name) => gradients[(name?.charCodeAt(0) || 0) % gradients.length];

  return (
    <div className="w-full sm:w-[300px] border-r border-border flex flex-col shrink-0" style={{ background: "hsl(240 10% 5%)" }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-base font-heading font-bold tracking-tight">Messages</h2>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition-all hover:scale-105 active:scale-95">
                <Plus className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-2xl">
              <DropdownMenuItem onClick={onNewDM} className="gap-2.5 cursor-pointer py-2.5">
                <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                </div>
                New Message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewGroup} className="gap-2.5 cursor-pointer py-2.5">
                <div className="w-6 h-6 rounded-md bg-accent/15 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-accent" />
                </div>
                New Group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewExternal} className="gap-2.5 cursor-pointer py-2.5">
                <div className="w-6 h-6 rounded-md bg-yellow-500/15 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-yellow-500" />
                </div>
                Email / SMS
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9 bg-secondary/30 border-border/40 rounded-xl h-9 text-sm focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-7 h-7 opacity-30" />
            </div>
            <p className="text-xs text-center leading-relaxed">{search ? `No results for "${search}"` : "No conversations yet.\nTap + to start one!"}</p>
          </div>
        ) : (
          <div className="px-2 space-y-0.5">
            {filtered.map(conv => {
              const other = getOtherUser(conv);
              const displayName = conv.type === "group" ? conv.name : (other?.display_name || other?.full_name || "Unknown");
              const avatar = conv.type === "group" ? conv.avatar_url : other?.avatar_url;
              const isSelected = selectedId === conv.id;
              const gradient = getGradient(displayName);

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group",
                    isSelected
                      ? "bg-primary/15 shadow-sm"
                      : "hover:bg-secondary/40"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="w-11 h-11 shadow-md">
                      <AvatarImage src={avatar} />
                      <AvatarFallback className={cn("font-bold text-sm bg-gradient-to-br text-white", gradient)}>
                        {displayName?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {conv.type === "group" && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-accent rounded-full flex items-center justify-center border-2 border-background">
                        <Users className="w-2 h-2 text-white" />
                      </div>
                    )}
                    {/* Online status dot */}
                    {conv.type !== "group" && other && (
                      <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background transition-opacity", other.is_online ? "bg-green-500 opacity-100" : "bg-muted-foreground/40 opacity-60")} title={other.is_online ? "Online" : "Offline"} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-1">
                      <p className={cn("text-sm font-semibold truncate", isSelected ? "text-primary" : "text-foreground")}>{displayName}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {unreadCounts[conv.id] > 0 && (
                          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground">
                            {unreadCounts[conv.id] > 99 ? "99+" : unreadCounts[conv.id]}
                          </div>
                        )}
                        {conv.last_message_at && (
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5 leading-snug">
                      {conv.last_message_text || <span className="italic opacity-60">Start the conversation</span>}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}