import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { recordSquadActivity } from "@/lib/squadBonus";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import ConversationList from "@/components/messages/ConversationList";
import ContactsTab from "@/components/messages/ContactsTab";
import ChatView from "@/components/messages/ChatView";
import NewChatDialog from "@/components/messages/NewChatDialog";
import GroupChatDialog from "@/components/messages/GroupChatDialog";
import ExternalMessageDialog from "@/components/messages/ExternalMessageDialog";
import GlobalInviteDialog from "@/components/GlobalInviteDialog";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { toast } from "sonner";
import ModerationBanner from "@/components/messages/ModerationBanner";
import { MessageSquare, Users, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createClientMessageKey, applySendSuccess, applySendFailure } from "@/lib/messageCache";
import { useSubscription } from "@/hooks/useSubscription";
import { CHAT_THEME_ENTITLEMENT, getChatTheme, resolveEffectiveChatThemeId } from "@/lib/chatThemes";

export default function Messages() {
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("chats");
  const { hasEntitlement } = useSubscription();

  // Mark a conversation as read (stores timestamp in localStorage for the unread badge).
  const markConversationRead = (convId) => {
    if (!convId) return;
    try { localStorage.setItem(`lastReadAt:${convId}`, Date.now().toString()); } catch {}
  };

  const handleSelectConv = (convId) => {
    setSelectedConvId(convId);
    markConversationRead(convId);
  };

  useEffect(() => {
    if (location.pathname === "/messages" && !location.search) {
      setSelectedConvId(null);
    }
  }, [location.pathname, location.search]);

  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showExternal, setShowExternal] = useState(false);
  const queryClient = useQueryClient();

  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    const sendPresence = (isOnline) => {
      if (!currentUser) return;
      base44.functions.invoke("updateUserPresence", { isOnline }).catch(() => {});
    };

    const handleVisibilityChange = async () => {
      const isOnline = document.visibilityState === "visible";
      sendPresence(isOnline);
      if (isOnline) {
        // Immediately refresh messages and conversations when returning to the tab
        queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (currentUser) sendPresence(document.visibilityState === "visible");

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") sendPresence(true);
    }, 60_000);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sendPresence(false);
    };
  }, [currentUser, queryClient, selectedConvId]);

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await base44.functions.invoke('listPublicUsers', {});
      return res.data?.users || [];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => base44.entities.Conversation.list("-last_message_at"),
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const myConversations = conversations.filter(c => c.participant_ids?.includes(currentUser?.id));

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["messages", selectedConvId],
    queryFn: async () => {
      const msgs = await base44.entities.Message.filter({ conversation_id: selectedConvId }, "-created_date", 200);
      return msgs.reverse();
    },
    enabled: !!selectedConvId,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  // Message and conversation lists already poll every five seconds above.
  // Avoid raw realtime entity subscriptions so the client never receives an
  // event payload outside the normal scoped read query path.

  const editMessage = useMutation({
    mutationFn: async ({ id, text }) => {
      const res = await base44.functions.invoke("mutateConversationMessage", {
        action: "edit",
        message_id: id,
        text,
      });
      if (res?.data?.moderation) return { _flagged: res.data.moderation };
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data?.message;
    },
    onSuccess: (msg) => {
      if (msg?._flagged) {
        const f = msg._flagged;
        if (f.is_banned) toast.error("Edit blocked. Your account is now banned for repeated policy violations.");
        else if (f.action_taken === "timeout") toast.error("Edit blocked. You are timed out for 48 hours.");
        else toast.error("Edit blocked for a policy violation.");
        base44.auth.me().then(setCurrentUser).catch(() => {});
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (msgData) => {
      const res = await base44.functions.invoke("sendConversationMessage", {
        ...msgData,
        conversation_id: selectedConvId,
      });
      if (res?.data?.moderation) {
        return { _flagged: res.data.moderation };
      }
      if (res?.data?.error) {
        throw new Error(res.data.error);
      }
      return res?.data?.message;
    },
    onMutate: (msgData) => {
      queryClient.cancelQueries({ queryKey: ["messages", selectedConvId] });
      const previous = queryClient.getQueryData(["messages", selectedConvId]);
      const clientMessageKey = msgData.client_message_key || createClientMessageKey();
      msgData.client_message_key = clientMessageKey;
      const tempId = `temp-${clientMessageKey}`;
      const tempMsg = {
        id: tempId,
        _tempId: tempId,
        ...msgData,
        conversation_id: selectedConvId,
        sender_id: currentUser?.id,
        sender_name: currentUser?.display_name || currentUser?.full_name,
        sender_avatar: currentUser?.avatar_url,
        created_date: new Date().toISOString(),
        _optimistic: true,
      };
      queryClient.setQueryData(["messages", selectedConvId], (old = []) => [...old, tempMsg]);
      queryClient.setQueryData(["conversations"], (old = []) => {
        const updated = old.map(c =>
          c.id === selectedConvId
            ? { ...c, last_message_text: msgData.text || `Sent a ${msgData.type}`, last_message_at: tempMsg.created_date }
            : c
        );
        return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
      });
      return { previous, tempId, clientMessageKey };
    },
    onError: (err, _msgData, ctx) => {
      queryClient.setQueryData(["messages", selectedConvId], (old = []) =>
        applySendFailure(old, ctx?.clientMessageKey, err?.message)
      );
      if (err?.message === "timed_out") {
        toast.error("You are currently timed out and cannot send messages.");
      } else if (err?.message === "banned") {
        toast.error("You may only message an admin while your account is banned.");
      } else {
        toast.error("Message failed to send.");
      }
    },
    onSuccess: (msg, _vars, ctx) => {
      if (msg?._flagged) {
        const f = msg._flagged;
        queryClient.setQueryData(["messages", selectedConvId], (old = []) =>
          old.filter(m => m._tempId !== ctx?.tempId)
        );
        const labels = {
          violence: "violence", racism: "racism", sexual_violence: "sexual violence",
          bullying: "bullying", illegal_activity: "illegal activity",
        };
        if (f.is_banned) {
          toast.error("You have been banned for repeated policy violations. To appeal, message an admin.");
        } else if (f.action_taken === "timeout") {
          toast.error(`Message blocked for ${labels[f.category] || "a policy violation"}. 2nd offence — you are timed out for 48 hours.`);
        } else {
          toast.error(`Message blocked for ${labels[f.category] || "a policy violation"}. This is your 1st warning — a 2nd offence is a 48-hour timeout.`);
        }
        base44.auth.me().then(setCurrentUser).catch(() => {});
        return;
      }
      queryClient.setQueryData(["messages", selectedConvId], (old = []) =>
        applySendSuccess(old, msg, ctx?.clientMessageKey, ctx?.tempId)
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (msg?.id && msg?.type !== "session") {
        recordSquadActivity("message", msg.id);
      }
    },
  });

  const isTimedOut = currentUser?.timeout_until && new Date(currentUser.timeout_until) > new Date();

  const handleReact = async (messageId, emoji) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !currentUser) return;
    const previous = queryClient.getQueryData(["messages", selectedConvId]);
    const optimisticReactions = { ...(msg.reactions || {}) };
    const userKey = `${emoji}__${currentUser.id}`;
    if (optimisticReactions[userKey]) delete optimisticReactions[userKey];
    else optimisticReactions[userKey] = emoji;

    queryClient.setQueryData(["messages", selectedConvId], (old = []) =>
      old.map(m => (m.id === messageId ? { ...m, reactions: optimisticReactions } : m))
    );
    try {
      const res = await base44.functions.invoke("mutateConversationMessage", {
        action: "react",
        message_id: messageId,
        emoji,
      });
      if (res?.data?.error) throw new Error(res.data.error);
    } catch (err) {
      if (previous) queryClient.setQueryData(["messages", selectedConvId], previous);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
    }
  };

  const startDM = async (otherUser) => {
    if (!otherUser?.id || !currentUser?.id) return;
    try {
      const existing = myConversations.find(c =>
        c.type === "dm" && c.participant_ids?.includes(otherUser.id) && c.participant_ids?.length === 2
      );
      if (existing) { handleSelectConv(existing.id); return; }
      const created = await base44.functions.invoke("manageConversation", {
        action: "create_dm",
        participant_ids: [otherUser.id],
      });
      if (created?.data?.error) throw new Error(created.data.error);
      const conv = created?.data?.conversation;
      if (!conv?.id) throw new Error("Conversation was not created");
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      handleSelectConv(conv.id);
    } catch (err) {
      toast.error("Couldn't start the conversation. Please try again.");
    }
  };

  const createGroup = async ({ name, participant_ids }) => {
    if (!currentUser?.id || !participant_ids?.length) return;
    try {
      const created = await base44.functions.invoke("manageConversation", {
        action: "create_group",
        name,
        participant_ids,
      });
      if (created?.data?.error) throw new Error(created.data.error);
      const conv = created?.data?.conversation;
      if (!conv?.id) throw new Error("Group was not created");
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      handleSelectConv(conv.id);
    } catch (err) {
      toast.error("Couldn't create the group. Please try again.");
    }
  };

  const selectedConv = myConversations.find(c => c.id === selectedConvId);
  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  // Banned users may still message an admin (to appeal). Timed-out users are fully blocked.
  const convHasAdmin = selectedConv?.participant_ids?.some(
    id => id !== currentUser?.id && users.find(u => u.id === id)?.role === "admin"
  );
  const isBlocked = currentUser?.is_banned
    ? !convHasAdmin
    : isTimedOut;
  const activeChatTheme = getChatTheme(resolveEffectiveChatThemeId(
    currentUser?.chat_theme_id,
    hasEntitlement?.(CHAT_THEME_ENTITLEMENT) === true,
  ));

  return (
    <div className="absolute inset-0 sm:relative sm:inset-auto sm:h-[calc(100vh-80px)] p-0 sm:p-4 md:p-6 flex justify-center overflow-hidden">
      <div className="w-full max-w-7xl h-full max-h-full flex flex-col sm:flex-row bg-card/60 sm:bg-card/40 backdrop-blur-3xl sm:border border-border/40 sm:rounded-[2.5rem] shadow-none sm:shadow-2xl overflow-hidden relative">
        
        {/* Sidebar */}
        <div className={cn(
          "w-full sm:w-[360px] md:w-[400px] shrink-0 h-full min-h-0 flex flex-col bg-background/40 sm:border-r border-border/30 transition-all z-10 relative",
          selectedConvId ? "hidden sm:flex" : "flex"
        )}>
          {/* Header */}
          <div className="px-6 pt-8 pb-2 flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-heading font-bold tracking-tight">Messages</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20" title="New Conversation Options" aria-label="New Conversation Options">
                    <Plus className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl p-2">
                  <DropdownMenuItem onClick={() => setShowNewDM(true)} className="gap-3 cursor-pointer py-3 px-3 rounded-xl focus:bg-primary/10 focus:text-primary">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">New Message</span>
                      <span className="text-[10px] text-muted-foreground">Start a direct chat</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowNewGroup(true)} className="gap-3 cursor-pointer py-3 px-3 rounded-xl focus:bg-accent/10 focus:text-accent">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">New Group</span>
                      <span className="text-[10px] text-muted-foreground">Create a room</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowInvite(true)} className="gap-3 cursor-pointer py-3 px-3 rounded-xl focus:bg-chart-3/10 focus:text-chart-3">
                    <div className="w-8 h-8 rounded-full bg-chart-3/20 flex items-center justify-center">
                      <UserPlus className="w-4 h-4 text-chart-3" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">Send Invite</span>
                      <span className="text-[10px] text-muted-foreground">Invite external users</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-6 border-b border-border/40 pb-0">
              <button 
                onClick={() => setSidebarTab("chats")}
                className={cn("pb-3 text-sm font-semibold transition-colors relative", sidebarTab === "chats" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Chats
                {sidebarTab === "chats" && <motion.div layoutId="activeTabMsg" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              <button 
                onClick={() => setSidebarTab("contacts")}
                className={cn("pb-3 text-sm font-semibold transition-colors relative", sidebarTab === "contacts" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Network
                {sidebarTab === "contacts" && <motion.div layoutId="activeTabMsg" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden relative bg-background/40">
            <AnimatePresence mode="wait">
              {sidebarTab === "chats" ? (
                <motion.div key="chats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col bg-background/40">
                  <PullToRefresh onRefresh={async () => { await queryClient.invalidateQueries({ queryKey: ["conversations"] }); }} className="flex-1 overflow-y-auto">
                    <ConversationList
                      conversations={conversations}
                      myConversations={myConversations}
                      selectedId={selectedConvId}
                      onSelect={handleSelectConv}
                      users={users}
                      currentUserId={currentUser?.id}
                      onStartDM={startDM}
                    />
                  </PullToRefresh>
                </motion.div>
              ) : (
                <motion.div key="contacts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col pt-2 bg-background/40">
                  <ContactsTab 
                    currentUserId={currentUser?.id} 
                    onMessageContact={(u) => { startDM(u); setSidebarTab("chats"); }} 
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Chat View */}
        <div className={cn(
        "flex-1 flex flex-col min-w-0 bg-transparent relative z-0 overflow-hidden",
        !selectedConvId && "hidden sm:flex"
        )}>
          {selectedConv ? (
            <ChatView
              conversation={selectedConv}
              messages={messages}
              isLoading={isLoadingMessages}
              currentUser={currentUser}
              users={users}
              isBlocked={isBlocked}
              moderationBanner={isBlocked ? <ModerationBanner currentUser={currentUser} /> : null}
              theme={activeChatTheme}
              onSendMessage={(data) => {
                if (isBlocked) {
                  toast.error(currentUser?.is_banned ? "You are banned from sending messages." : "You are timed out and cannot send messages right now.");
                  return;
                }
                sendMessage.mutate(data);
              }}
              onEditMessage={(id, text) => editMessage.mutate({ id, text })}
              onReact={handleReact}
              onBack={() => setSelectedConvId(null)}
              onStartDM={startDM}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-8 shadow-[0_0_60px_-15px_rgba(var(--primary),0.3)] border border-white/5 backdrop-blur-xl">
                  <div className="w-24 h-24 rounded-full bg-card flex items-center justify-center shadow-inner">
                    <MessageSquare className="w-10 h-10 text-primary/60" />
                  </div>
                </div>
                <h2 className="text-2xl font-heading font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">Your Messages</h2>
                <p className="text-base text-muted-foreground max-w-[300px] leading-relaxed">
                  Select a conversation from the sidebar or start a new one to connect with your network.
                </p>
                <div className="mt-8 flex gap-3">
                  <Button onClick={() => setShowNewDM(true)} className="rounded-xl shadow-lg shadow-primary/20">
                    <MessageSquare className="w-4 h-4 mr-2" /> New Chat
                  </Button>
                  <Button onClick={() => setShowNewGroup(true)} variant="secondary" className="rounded-xl border border-border/50">
                    <Users className="w-4 h-4 mr-2" /> New Group
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      <NewChatDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        users={otherUsers}
        onSelectUser={(u) => { startDM(u); setShowNewDM(false); }}
        currentUserId={currentUser?.id}
      />
      <GroupChatDialog
        open={showNewGroup}
        onOpenChange={setShowNewGroup}
        users={otherUsers}
        onCreate={createGroup}
      />
      <ExternalMessageDialog
        open={showExternal}
        onOpenChange={setShowExternal}
      />
      <GlobalInviteDialog 
        open={showInvite}
        onOpenChange={setShowInvite}
      />
    </div>
  );
}