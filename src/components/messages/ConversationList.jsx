import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Users, Hash, UserPlus, MessageSquare, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

import React from "react";

export default React.memo(function ConversationList({ conversations, myConversations, selectedId, onSelect, users, currentUserId, onStartDM }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, unread, groups
  const [pendingRoomId, setPendingRoomId] = useState(null);

  const getOtherUser = (conv) => {
    if (conv.type === "group") return null;
    const otherId = conv.participant_ids?.find(id => id !== currentUserId);
    return users?.find(u => u.id === otherId);
  };

  // Unread check: a conversation is unread if its last message is newer than
  // the last time the user opened it (tracked in localStorage by Messages.jsx).
  const isUnread = (conv) => {
    if (!conv.last_message_at) return false;
    try {
      const lastRead = localStorage.getItem(`lastReadAt:${currentUserId}:${conv.id}`);
      if (!lastRead) return true;
      return new Date(conv.last_message_at).getTime() > parseInt(lastRead);
    } catch { return false; }
  };

  const onlineUsers = (users || []).filter(u => u.is_online && u.id !== currentUserId).slice(0, 12);

  // Searching applies globally to find NEW people to message too
  const searchResults = useMemo(() => {
    const term = search.toLowerCase();
    
    // Filter existing chats
    let filteredChats = myConversations.filter(conv => {
      const other = getOtherUser(conv);
      const name = conv.type === "group" ? conv.name : (other?.display_name || other?.full_name || "");
      if (!name.toLowerCase().includes(term)) return false;
      if (filter === "unread" && !isUnread(conv)) return false;
      if (filter === "groups" && conv.type !== "group") return false;
      return true;
    });

    // Discover public groups
    const discoverGroups = term ? conversations.filter(c => 
      c.type === "group" && 
      !c.participant_ids?.includes(currentUserId) &&
      c.name?.toLowerCase().includes(term)
    ) : [];

    if (term.startsWith("#") && !discoverGroups.some(g => g.name?.toLowerCase() === term)) {
      discoverGroups.push({
         id: "mock_" + term,
         name: term,
         type: "group",
         participant_ids: [],
         isMock: true
      });
    }

    // Find new users to DM
    const discoverUsers = term ? users.filter(u => 
      u.id !== currentUserId &&
      (u.display_name?.toLowerCase().includes(term) || u.full_name?.toLowerCase().includes(term)) &&
      !myConversations.some(c => c.type === "dm" && c.participant_ids?.includes(u.id))
    ) : [];

    return { filteredChats, discoverGroups, discoverUsers };
  }, [search, filter, myConversations, conversations, users, currentUserId, selectedId]);

  const gradients = [
    "from-primary to-pink-500", "from-accent to-cyan-400", "from-yellow-500 to-orange-500",
    "from-green-400 to-emerald-600", "from-purple-500 to-indigo-500", "from-rose-500 to-pink-500",
  ];
  const getGradient = (name) => gradients[(name?.charCodeAt(0) || 0) % gradients.length];

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background/20">
      {/* Search Bar */}
      <div className="shrink-0 border-b border-border/30 bg-background/70 px-4 pb-3 pt-3 backdrop-blur-xl sm:px-6">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messages or find people..."
            title="Search conversations"
            aria-label="Search conversations"
            className="h-11 pl-11 pr-4 bg-secondary/55 border border-border/50 rounded-2xl shadow-inner focus:bg-background/90 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all text-sm placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Trending Topics */}
      {!search && (
        <div className="pl-4 sm:pl-6 mt-3 mb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0 pb-2 after:content-[''] after:w-6 after:shrink-0">
          <span className="text-xs font-bold text-muted-foreground uppercase flex items-center shrink-0 mr-1">Trending:</span>
          {["#TikTokMusic", "#ViralSounds", "#DrakeVsKendrick", "#AIinMusic", "#Eurovision", "#Grammys", "#BeatMakers"].map(topic => (
             <button
                key={topic}
                onClick={() => setSearch(topic.toLowerCase())}
                className="ui-hover min-h-9 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
             >
                {topic}
             </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {!search && (
        <div className="px-4 sm:px-6 mb-3 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          {["all", "unread", "groups"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "ui-hover min-h-10 px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all whitespace-nowrap touch-manipulation",
                filter === f 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
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

      {/* Active Now — horizontal avatar strip (Messenger pattern) */}
      {!search && onlineUsers.length > 0 && (
        <div className="mx-3 sm:mx-4 mb-3 shrink-0 rounded-2xl border border-border/35 bg-gradient-to-r from-primary/[0.07] via-secondary/35 to-accent/[0.06] px-3 py-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-bold text-foreground/80 uppercase tracking-[0.14em]">Active Now</p>
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-500">{onlineUsers.length} online</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {onlineUsers.map(u => (
              <button
                key={u.id}
                onClick={() => {
                  Promise.resolve(onStartDM(u)).catch((error) => {
                    console.error("Failed to start DM from Active Now:", error);
                    toast.error("Couldn't start this conversation. Please try again.");
                  });
                }}
                className="ui-hover flex min-w-[64px] min-h-[78px] flex-col items-center justify-center gap-1.5 shrink-0 group rounded-2xl px-1 py-1.5 hover:bg-background/70 transition-all touch-manipulation focus-visible:ring-2 focus-visible:ring-primary/40"
                title={`Message ${u.display_name || u.full_name}`}
                aria-label={`Message ${u.display_name || u.full_name}`}
              >
                <div className="relative">
                  <Avatar className="w-14 h-14 border-2 border-primary/30 group-hover:border-primary/60 transition-colors">
                    <AvatarImage src={u.avatar_url} />
                    <AvatarFallback className={cn("font-bold text-sm text-white bg-gradient-to-br", getGradient(u.display_name || u.full_name))}>
                      {(u.display_name || u.full_name)?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background shadow-sm" aria-label="Active now" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[60px] text-center">
                  {(u.display_name || u.full_name || "")?.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1 space-y-1.5 custom-scrollbar">
        {searchResults.filteredChats.length === 0 && !search && (
          <div className="text-center py-12 px-6">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 items-center justify-center mb-4">
              <MessageSquare className="w-7 h-7 text-primary" />
            </div>
            <p className="font-heading font-bold text-base text-foreground mb-1">No conversations yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-[200px] mx-auto leading-relaxed">
              Search for someone above or tap the + button to start your first chat.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["#TikTokMusic", "#BeatMakers"].map(topic => (
                <button
                  key={topic}
                  onClick={() => setSearch(topic.toLowerCase())}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Existing Chats */}
        {searchResults.filteredChats.map(conv => {
          const other = getOtherUser(conv);
          const displayName = conv.type === "group" ? conv.name : (other?.display_name || other?.full_name || conv.name || "User");
          const avatar = conv.type === "group" ? conv.avatar_url : other?.avatar_url;
          const isSelected = selectedId === conv.id;
          const gradient = getGradient(displayName);
          const unread = isUnread(conv);

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "ui-surface ui-hover w-full min-h-[82px] flex items-center gap-3.5 p-3.5 rounded-3xl transition-all duration-200 text-left group relative touch-manipulation focus-visible:ring-2 focus-visible:ring-primary/40 border",
                isSelected
                  ? "bg-gradient-to-r from-primary/[0.14] to-primary/[0.05] shadow-lg shadow-black/10 border-primary/30 z-10"
                  : "bg-card/65 border-border/45 hover:bg-card/90 hover:border-primary/25 hover:shadow-md active:bg-secondary/65"
              )}
              title={`Open chat with ${displayName}`}
              aria-label={`Open chat with ${displayName}`}
              aria-pressed={isSelected}
            >
              <div className="relative shrink-0">
                <Avatar className={cn("w-12 h-12 shadow-sm transition-all", unread && !isSelected && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background")}>
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
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-[2.5px] border-background shadow-sm" aria-label="Active now" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <p className={cn("font-semibold truncate pr-2 text-[15px]", isSelected ? "text-primary" : unread ? "text-foreground" : "text-foreground/90")}>
                    {displayName}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unread && !isSelected && <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />}
                    {conv.last_message_at && !isNaN(new Date(conv.last_message_at).getTime()) && (
                      <span className={cn("text-[11px] font-medium", unread ? "text-primary" : isSelected ? "text-primary/80" : "text-muted-foreground/70")}>
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false }).replace('about ','').replace('less than a minute','now')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  {conv.type !== "group" && other?.location && (
                    <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/70">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{other.location}</span>
                    </span>
                  )}
                  <p className={cn("min-w-0 flex-1 truncate text-[12px] leading-snug select-none", isSelected ? "text-foreground/60" : unread ? "text-muted-foreground font-medium" : "text-muted-foreground/65")} aria-hidden="true">
                    {conv.last_message_text ? "New message" : <span className="italic opacity-60">Start chatting...</span>}
                  </p>
                </div>
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
                onClick={async () => {
                  try {
                    await onStartDM(user);
                    setSearch("");
                  } catch (error) {
                    console.error("Failed to start discovered-user DM:", error);
                    toast.error("Couldn't start this conversation. Please try again.");
                  }
                }}
                className="w-full min-h-[68px] flex items-center gap-4 p-3.5 rounded-2xl hover:bg-secondary/50 active:bg-secondary/60 transition-all text-left group touch-manipulation"
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
                  if (pendingRoomId) return;
                  setPendingRoomId(room.id);
                  try {
                    let roomId = room.id;
                    if (room.isMock) {
                      const res = await base44.functions.invoke("manageConversation", {
                        action: "create_public",
                        name: room.name,
                      });
                      if (res?.data?.error) throw new Error(res.data.error);
                      const createdRoom = res?.data?.conversation;
                      roomId = createdRoom?.id;
                      if (
                        res?.data?.success !== true ||
                        res?.data?.action !== "create_public" ||
                        res?.data?.userId !== currentUserId ||
                        res?.data?.conversationId !== roomId ||
                        res?.data?.roomName !== room.name ||
                        !roomId ||
                        createdRoom?.type !== "group" ||
                        createdRoom?.is_public !== true ||
                        !Array.isArray(createdRoom?.participant_ids) ||
                        !createdRoom.participant_ids.includes(currentUserId)
                      ) throw new Error("Public room was not created");
                    } else {
                      const res = await base44.functions.invoke("manageConversation", {
                        action: "join_public",
                        conversationId: room.id,
                      });
                      if (res?.data?.error) throw new Error(res.data.error);
                      const joinedRoom = res?.data?.conversation;
                      if (
                        res?.data?.success !== true ||
                        res?.data?.action !== "join_public" ||
                        res?.data?.userId !== currentUserId ||
                        res?.data?.conversationId !== room.id ||
                        joinedRoom?.id !== room.id ||
                        joinedRoom?.type !== "group" ||
                        joinedRoom?.is_public !== true ||
                        !Array.isArray(joinedRoom?.participant_ids) ||
                        !joinedRoom.participant_ids.includes(currentUserId)
                      ) throw new Error("Public room join was not confirmed");
                    }
                    onSelect(roomId);
                    setSearch("");
                  } catch {
                    toast.error("Couldn't open the public room. Please try again.");
                  } finally {
                    setPendingRoomId(null);
                  }
                }}
                disabled={!!pendingRoomId}
                className="w-full min-h-[68px] flex items-center gap-4 p-3.5 rounded-2xl hover:bg-secondary/50 active:bg-secondary/60 transition-all text-left group touch-manipulation"
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
});