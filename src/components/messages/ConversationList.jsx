import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Users, Hash, UserPlus, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";

export default function ConversationList({ conversations, myConversations, selectedId, onSelect, users, currentUserId, onStartDM }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, unread, groups

  const getOtherUser = (conv) => {
    if (conv.type === "group") return null;
    const otherId = conv.participant_ids?.find(id => id !== currentUserId);
    return users?.find(u => u.id === otherId);
  };

  // Searching applies globally to find NEW people to message too
  const searchResults = useMemo(() => {
    const term = search.toLowerCase();
    
    // Filter existing chats
    let filteredChats = myConversations.filter(conv => {
      const other = getOtherUser(conv);
      const name = conv.type === "group" ? conv.name : (other?.display_name || other?.full_name || "");
      if (!name.toLowerCase().includes(term)) return false;
      if (filter === "groups" && conv.type !== "group") return false;
      return true;
    });

    // Discover public groups
    const discoverGroups = term ? conversations.filter(c => 
      c.type === "group" && 
      !c.participant_ids?.includes(currentUserId) &&
      c.name?.toLowerCase().includes(term)
    ) : [];

    // Find new users to DM
    const discoverUsers = term ? users.filter(u => 
      u.id !== currentUserId &&
      (u.display_name?.toLowerCase().includes(term) || u.full_name?.toLowerCase().includes(term)) &&
      !myConversations.some(c => c.type === "dm" && c.participant_ids?.includes(u.id))
    ) : [];

    return { filteredChats, discoverGroups, discoverUsers };
  }, [search, filter, myConversations, conversations, users, currentUserId]);

  const gradients = [
    "from-primary to-pink-500", "from-accent to-cyan-400", "from-yellow-500 to-orange-500",
    "from-green-400 to-emerald-600", "from-purple-500 to-indigo-500", "from-rose-500 to-pink-500",
  ];
  const getGradient = (name) => gradients[(name?.charCodeAt(0) || 0) % gradients.length];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search Bar */}
      <div className="px-6 mb-4 shrink-0">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messages or find people..."
            className="pl-10 pr-4 py-6 bg-secondary/40 border-transparent rounded-2xl shadow-inner focus:bg-background/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
          />
        </div>
      </div>

      {/* Filters */}
      {!search && (
        <div className="px-6 mb-4 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          {["all", "groups"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all whitespace-nowrap",
                filter === f 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title={`Filter by ${f}`}
              aria-label={`Filter by ${f}`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1 custom-scrollbar">
        {searchResults.filteredChats.length === 0 && !search && (
          <div className="text-center py-10 px-4 text-muted-foreground">
            <p className="text-sm">No conversations yet.</p>
            <p className="text-xs mt-1 opacity-70">Start one by tapping the + button above.</p>
          </div>
        )}

        {/* Existing Chats */}
        {searchResults.filteredChats.map(conv => {
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
                "w-full flex items-center gap-4 p-3 rounded-2xl transition-all text-left group relative",
                isSelected
                  ? "bg-background/80 shadow-md border border-border/50 z-10"
                  : "hover:bg-secondary/40 border border-transparent"
              )}
              title={`Open chat with ${displayName}`}
              aria-label={`Open chat with ${displayName}`}
            >
              <div className="relative shrink-0">
                <Avatar className="w-12 h-12 shadow-sm">
                  <AvatarImage src={avatar} />
                  <AvatarFallback className={cn("font-bold text-sm bg-gradient-to-br text-white", gradient)}>
                    {displayName?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                {conv.type === "group" && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center shadow-sm">
                    <Users className="w-3 h-3 text-accent" />
                  </div>
                )}
                {conv.type !== "group" && other?.is_online && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-[2.5px] border-background" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <p className={cn("font-semibold truncate pr-2 text-[15px]", isSelected ? "text-primary" : "text-foreground")}>
                    {displayName}
                  </p>
                  {conv.last_message_at && (
                    <span className={cn("text-[10px] shrink-0 font-medium", isSelected ? "text-primary/70" : "text-muted-foreground/60")}>
                      {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false }).replace('about ','').replace('less than a minute','now')}
                    </span>
                  )}
                </div>
                <p className={cn("text-xs truncate leading-snug", isSelected ? "text-foreground/80" : "text-muted-foreground/80")}>
                  {conv.last_message_text || <span className="italic opacity-60">Start chatting...</span>}
                </p>
              </div>
            </button>
          );
        })}

        {/* Global Search Results (People / Public Groups) */}
        {search && (searchResults.discoverUsers.length > 0 || searchResults.discoverGroups.length > 0) && (
          <div className="pt-4 mt-4 border-t border-border/50">
            <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider mb-2 px-3">Discover</h3>
            
            {searchResults.discoverUsers.map(user => (
              <button
                key={user.id}
                onClick={() => { onStartDM(user); setSearch(""); }}
                className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary/40 transition-all text-left group"
                title={`Start conversation with ${user.display_name || user.full_name}`}
                aria-label={`Start conversation with ${user.display_name || user.full_name}`}
              >
                <Avatar className="w-12 h-12 shadow-sm opacity-80 group-hover:opacity-100 transition-opacity">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className={cn("bg-gradient-to-br text-white", getGradient(user.display_name || user.full_name))}>
                    {(user.display_name || user.full_name)?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{user.display_name || user.full_name}</p>
                  <p className="text-xs text-primary font-medium mt-0.5 flex items-center gap-1">
                    <UserPlus className="w-3 h-3" /> Start conversation
                  </p>
                </div>
              </button>
            ))}

            {searchResults.discoverGroups.map(room => (
              <button
                key={room.id}
                onClick={async () => {
                  await base44.entities.Conversation.update(room.id, {
                    participant_ids: [...new Set([...(room.participant_ids || []), currentUserId])]
                  });
                  onSelect(room.id);
                  setSearch("");
                }}
                className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary/40 transition-all text-left group"
                title={`Join public room ${room.name}`}
                aria-label={`Join public room ${room.name}`}
              >
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                  <Hash className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{room.name}</p>
                  <p className="text-xs text-accent font-medium mt-0.5 flex items-center gap-1">
                    Join public room
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}