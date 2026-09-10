import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
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
import { sounds } from "@/hooks/use-sound";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { toast } from "sonner";
import ModerationBanner from "@/components/messages/ModerationBanner";
import { MessageSquare, Users, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  createClientMessageKey,
  applyQueuedMessage,
  applyDeliveryState,
  applySendSuccess,
  applySendFailure,
  removeClientMessage,
  applyRealtimeCreate,
} from "@/lib/messageCache";
import {
  createOutboundEntry,
  enqueueOutbound,
  flushOutboundQueue,
  getNextRetryAt,
  markOutboundForRetry,
  queueEntryToMessage,
  readOutboundQueue,
} from "@/lib/outboundQueue";

export default function Messages() {
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("chats");

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
  const retryTimerRef = useRef(null);
  const scheduleRetryRef = useRef(null);
  const userInitiatedKeysRef = useRef(new Set());

  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch((error) => {
      console.error("Unable to load the current user for messaging:", error);
    });
  }, []);

  useEffect(() => {
    const unsub = base44.entities.User.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    });
    return unsub;
  }, [queryClient]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      const isOnline = document.visibilityState === "visible";
      if (currentUser) {
        try {
          await base44.functions.invoke("updateUserPresence", { isOnline });
        } catch (err) {}
      }
      if (isOnline) {
        // Immediately refresh messages and conversations when returning to the tab
        queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (currentUser) {
      base44.functions.invoke("updateUserPresence", { isOnline: true }).catch(() => {});
    }
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [currentUser, queryClient, selectedConvId]);

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await base44.functions.invoke('listPublicUsers', {});
      return res.data?.users || [];
    },
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => base44.entities.Conversation.list("-last_message_at"),
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const myConversations = conversations.filter(c => c.participant_ids?.includes(currentUser?.id));
  const selectedConv = myConversations.find(c => c.id === selectedConvId);

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["messages", selectedConvId],
    queryFn: async () => {
      const msgs = await base44.entities.Message.filter({ conversation_id: selectedConvId }, "-created_date", 200);
      const queued = readOutboundQueue()
        .filter(entry =>
          entry.conversationId === selectedConvId &&
          entry.sender.id === currentUser.id
        )
        .map(queueEntryToMessage);
      return queued.reduce(
        (current, message) => applyQueuedMessage(current, message),
        msgs.reverse()
      );
    },
    enabled: !!selectedConvId && !!currentUser?.id,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubMsg = base44.entities.Message.subscribe(async (event) => {
      // For delete events, event.data may be null (the record is gone) —
      // remove by ID from the active conversation without requiring conversation_id.
      if (event.type === "delete") {
        queryClient.setQueryData(["messages", selectedConvId], (old = []) =>
          old.filter(m => m.id !== event.id)
        );
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        return;
      }

      if (!event.data?.conversation_id) return;

      let convs = queryClient.getQueryData(["conversations"]) || [];
      let isMyConv = convs.some(c => c.id === event.data.conversation_id && c.participant_ids?.includes(currentUser.id));

      if (!isMyConv) {
         try {
           const conv = await base44.entities.Conversation.get(event.data.conversation_id);
           if (conv && conv.participant_ids?.includes(currentUser.id)) {
             isMyConv = true;
           }
         } catch(e) {}
      }

      if (isMyConv) {
        if (event.type === "create" && event.data?.sender_id !== currentUser.id) {
          sounds.notification();
        }
        // If the user is viewing this conversation, mark it as read immediately
        if (event.data?.conversation_id === selectedConvId && document.visibilityState === "visible") {
          markConversationRead(selectedConvId);
        }
        // Apply the change directly to the cache for instant, lag-free updates
        // instead of refetching all messages from the server.
        if (event.data?.conversation_id === selectedConvId) {
          queryClient.setQueryData(["messages", selectedConvId], (old = []) => {
            if (event.type === "delete") {
              return old.filter(m => m.id !== event.id);
            }
            if (event.type === "update") {
              return old.map(m => (m.id === event.id ? { ...m, ...event.data } : m));
            }
            // Create: reconcile by stable client key, with a one-at-a-time
            // fallback only for older events that do not carry a key.
            return applyRealtimeCreate(old, event.data, event.id);
          });
        }
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    });

    const unsubConv = base44.entities.Conversation.subscribe((event) => {
      if (event.data?.participant_ids?.includes(currentUser.id)) {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    });

    return () => {
      unsubMsg();
      unsubConv();
    };
  }, [selectedConvId, queryClient, currentUser]);

  const editMessage = useMutation({
    mutationFn: async ({ id, text }) => {
      return await base44.entities.Message.update(id, { text, is_edited: true });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const showModerationRejection = useCallback((rejection) => {
    const labels = {
      violence: "violence",
      racism: "racism",
      sexual_violence: "sexual violence",
      bullying: "bullying",
      illegal_activity: "illegal activity",
    };
    if (rejection.is_banned) {
      toast.error("You have been banned for repeated policy violations. To appeal, message an admin.");
    } else if (rejection.action_taken === "timeout") {
      toast.error(`Message blocked for ${labels[rejection.category] || "a policy violation"}. 2nd offence — you are timed out for 48 hours.`);
    } else {
      toast.error(`Message blocked for ${labels[rejection.category] || "a policy violation"}. This is your 1st warning — a 2nd offence is a 48-hour timeout.`);
    }
    base44.auth.me().then(setCurrentUser).catch((error) => {
      console.error("Unable to refresh moderation status:", error);
    });
  }, []);

  const flushMessages = useCallback(async () => {
    if (!currentUser?.id) return;
    await flushOutboundQueue({
      userId: currentUser.id,
      send: async (entry) => {
        const response = await base44.functions.invoke("sendMessage", {
          conversation_id: entry.conversationId,
          client_message_key: entry.clientMessageKey,
          message: entry.payload,
        });
        return response.data;
      },
      onSending: (entry) => {
        queryClient.setQueryData(["messages", entry.conversationId], (old = []) =>
          applyDeliveryState(old, entry.clientMessageKey, "sending", {
            _optimistic: true,
            _retryable: false,
            _sendError: null,
          })
        );
      },
      onSent: (entry, message) => {
        queryClient.setQueryData(["messages", entry.conversationId], (old = []) =>
          applySendSuccess(old, message, entry.clientMessageKey)
        );
        userInitiatedKeysRef.current.delete(entry.clientMessageKey);
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      },
      onRejected: (entry, rejection) => {
        queryClient.setQueryData(["messages", entry.conversationId], (old = []) =>
          removeClientMessage(old, entry.clientMessageKey)
        );
        userInitiatedKeysRef.current.delete(entry.clientMessageKey);
        if (rejection.type === "moderation") {
          showModerationRejection(rejection);
        } else {
          toast.error(rejection.message || "This message cannot be sent.");
        }
      },
      onFailed: (entry) => {
        queryClient.setQueryData(["messages", entry.conversationId], (old = []) =>
          applySendFailure(old, entry.clientMessageKey, entry.lastError)
        );
        if (userInitiatedKeysRef.current.delete(entry.clientMessageKey)) {
          toast.error("Message not sent. Tap Retry to try again.");
        }
      },
    });
    scheduleRetryRef.current?.();
  }, [currentUser?.id, queryClient, showModerationRejection]);

  useEffect(() => {
    const scheduleRetry = () => {
      clearTimeout(retryTimerRef.current);
      if (!currentUser?.id || !navigator.onLine) return;
      const nextRetryAt = getNextRetryAt(undefined, currentUser.id);
      if (nextRetryAt === null) return;
      retryTimerRef.current = setTimeout(
        () => flushMessages(),
        Math.max(0, nextRetryAt - Date.now())
      );
    };
    scheduleRetryRef.current = scheduleRetry;

    const handleOnline = () => flushMessages();
    window.addEventListener("online", handleOnline);
    flushMessages();
    scheduleRetry();
    return () => {
      window.removeEventListener("online", handleOnline);
      clearTimeout(retryTimerRef.current);
      scheduleRetryRef.current = null;
    };
  }, [currentUser?.id, flushMessages]);

  const handleSendMessage = useCallback((payload) => {
    if (!currentUser?.id || !selectedConvId) return;
    const clientMessageKey = createClientMessageKey();
    const entry = createOutboundEntry({
      clientMessageKey,
      conversationId: selectedConvId,
      payload,
      sender: {
        id: currentUser.id,
        name: currentUser.display_name || currentUser.full_name,
        avatar: currentUser.avatar_url,
      },
    });

    try {
      enqueueOutbound(entry);
    } catch (error) {
      console.error("Unable to persist the outbound message:", error);
      toast.error("Couldn't save this message for reliable delivery.");
      return;
    }

    const queuedMessage = queueEntryToMessage(entry);
    queryClient.setQueryData(["messages", selectedConvId], (old = []) =>
      applyQueuedMessage(old, queuedMessage)
    );
    queryClient.setQueryData(["conversations"], (old = []) => {
      const updated = old.map(conversation =>
        conversation.id === selectedConvId
          ? {
              ...conversation,
              last_message_text: payload.text || `Sent a ${payload.type}`,
              last_message_at: entry.createdAt,
            }
          : conversation
      );
      return updated.sort((a, b) =>
        new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
      );
    });

    if (navigator.onLine) {
      userInitiatedKeysRef.current.add(clientMessageKey);
      flushMessages();
    }
  }, [currentUser, flushMessages, queryClient, selectedConvId]);

  const retryMessage = useCallback((message) => {
    const clientMessageKey = message?.client_message_key;
    if (!clientMessageKey) return;
    let entry;
    try {
      entry = markOutboundForRetry(clientMessageKey);
    } catch (error) {
      console.error("Unable to update the queued message for retry:", error);
      toast.error("Couldn't queue this message for retry.");
      return;
    }
    if (!entry) {
      toast.error("This message is no longer in the outbound queue.");
      return;
    }
    queryClient.setQueryData(["messages", entry.conversationId], (old = []) =>
      applyDeliveryState(old, clientMessageKey, navigator.onLine ? "sending" : "queued", {
        _retryable: false,
        _sendError: null,
      })
    );
    if (navigator.onLine) {
      userInitiatedKeysRef.current.add(clientMessageKey);
      flushMessages();
    }
  }, [flushMessages, queryClient]);

  const isTimedOut = currentUser?.timeout_until && new Date(currentUser.timeout_until) > new Date();

  const handleReact = async (messageId, emoji) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !currentUser) return;
    const reactions = { ...(msg.reactions || {}) };
    const userKey = `${emoji}__${currentUser.id}`;
    if (reactions[userKey]) delete reactions[userKey];
    else reactions[userKey] = emoji;
    
    const previous = queryClient.getQueryData(["messages", selectedConvId]);
    queryClient.setQueryData(["messages", selectedConvId], (old = []) =>
      old.map(m => (m.id === messageId ? { ...m, reactions } : m))
    );
    try {
      await base44.entities.Message.update(messageId, { reactions });
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
      const conv = await base44.entities.Conversation.create({
        type: "dm",
        participant_ids: [currentUser.id, otherUser.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      handleSelectConv(conv.id);
    } catch (err) {
      toast.error("Couldn't start the conversation. Please try again.");
    }
  };

  const createGroup = async ({ name, participant_ids }) => {
    if (!currentUser?.id || !participant_ids?.length) return;
    try {
      const conv = await base44.entities.Conversation.create({
        type: "group",
        name,
        participant_ids: [currentUser.id, ...participant_ids],
      });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      handleSelectConv(conv.id);
    } catch (err) {
      toast.error("Couldn't create the group. Please try again.");
    }
  };

  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  // Banned users may still message an admin (to appeal). Timed-out users are fully blocked.
  const convHasAdmin = selectedConv?.participant_ids?.some(
    id => id !== currentUser?.id && users.find(u => u.id === id)?.role === "admin"
  );
  const isBlocked = currentUser?.is_banned
    ? !convHasAdmin
    : isTimedOut;

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
              onSendMessage={(data) => {
                if (isBlocked) {
                  toast.error(currentUser?.is_banned ? "You are banned from sending messages." : "You are timed out and cannot send messages right now.");
                  return;
                }
                handleSendMessage(data);
              }}
              onRetryMessage={retryMessage}
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