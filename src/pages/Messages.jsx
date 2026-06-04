import { useState, useEffect } from "react";
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
import { sounds } from "@/hooks/use-sound";
import { MessageSquare, Users, Mail, Plus, Zap, UserPlus, Hash, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Messages() {
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("chats");

  useEffect(() => {
    if (location.pathname === "/messages" && !location.search) {
      setSelectedConvId(null);
    }
  }, [location.pathname, location.search]);

  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showExternal, setShowExternal] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      const isOnline = document.visibilityState === "visible";
      if (currentUser) {
        try {
          await base44.functions.invoke("updateUserPresence", { isOnline });
        } catch (err) {}
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (currentUser) {
      base44.functions.invoke("updateUserPresence", { isOnline: true }).catch(() => {});
    }
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [currentUser]);

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => base44.entities.Conversation.list("-last_message_at"),
  });

  const myConversations = conversations.filter(c => c.participant_ids?.includes(currentUser?.id));

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", selectedConvId],
    queryFn: async () => {
      const msgs = await base44.entities.Message.filter({ conversation_id: selectedConvId }, "-created_date", 300);
      return msgs.reverse();
    },
    enabled: !!selectedConvId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubMsg = base44.entities.Message.subscribe(async (event) => {
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
        if (event.data?.conversation_id === selectedConvId) {
          queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
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

  const sendMessage = useMutation({
    mutationFn: async (msgData) => {
      const msg = await base44.entities.Message.create({
        ...msgData,
        conversation_id: selectedConvId,
        sender_id: currentUser.id,
        sender_name: currentUser.display_name || currentUser.full_name,
        sender_avatar: currentUser.avatar_url,
      });
      await base44.entities.Conversation.update(selectedConvId, {
        last_message_text: msgData.text || `Sent a ${msgData.type}`,
        last_message_at: new Date().toISOString(),
      });
      return msg;
    },
    onMutate: async (msgData) => {
      await queryClient.cancelQueries({ queryKey: ["messages", selectedConvId] });
      const previous = queryClient.getQueryData(["messages", selectedConvId]);
      const tempMsg = {
        id: `temp-${Date.now()}`,
        ...msgData,
        conversation_id: selectedConvId,
        sender_id: currentUser?.id,
        sender_name: currentUser?.display_name || currentUser?.full_name,
        sender_avatar: currentUser?.avatar_url,
        created_date: new Date().toISOString(),
        _optimistic: true,
      };
      queryClient.setQueryData(["messages", selectedConvId], (old = []) => [...old, tempMsg]);
      return { previous };
    },
    onError: (_err, _msgData, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["messages", selectedConvId], ctx.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

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
      if (existing) { setSelectedConvId(existing.id); return; }
      const conv = await base44.entities.Conversation.create({
        type: "dm",
        participant_ids: [currentUser.id, otherUser.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedConvId(conv.id);
    } catch (err) {}
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
      setSelectedConvId(conv.id);
    } catch (err) {}
  };

  const selectedConv = myConversations.find(c => c.id === selectedConvId);
  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  return (
    <div className="h-[calc(100dvh-70px)] sm:h-[calc(100vh-80px)] p-0 sm:p-4 md:p-6 flex justify-center overflow-hidden">
      <div className="w-full max-w-7xl h-full flex flex-col sm:flex-row bg-card/60 sm:bg-card/40 backdrop-blur-3xl sm:border border-border/40 sm:rounded-[2.5rem] shadow-none sm:shadow-2xl overflow-hidden relative">
        
        {/* Sidebar */}
        <div className={cn(
          "w-full sm:w-[360px] md:w-[400px] shrink-0 flex flex-col bg-background/40 sm:border-r border-border/30 transition-all z-10 relative",
          selectedConvId ? "hidden sm:flex" : "flex"
        )}>
          {/* Header */}
          <div className="px-6 pt-8 pb-2 flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-heading font-bold tracking-tight">Messages</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20">
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

          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {sidebarTab === "chats" ? (
                <motion.div key="chats" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="absolute inset-0 flex flex-col">
                  <ConversationList
                    conversations={conversations}
                    myConversations={myConversations}
                    selectedId={selectedConvId}
                    onSelect={setSelectedConvId}
                    users={users}
                    currentUserId={currentUser?.id}
                    onStartDM={startDM}
                  />
                </motion.div>
              ) : (
                <motion.div key="contacts" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="absolute inset-0 flex flex-col pt-2">
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
          "flex-1 flex flex-col min-w-0 bg-transparent relative z-0",
          !selectedConvId && "hidden sm:flex"
        )}>
          {selectedConv ? (
            <ChatView
              conversation={selectedConv}
              messages={messages}
              currentUser={currentUser}
              users={users}
              onSendMessage={(data) => sendMessage.mutate(data)}
              onEditMessage={(id, text) => editMessage.mutate({ id, text })}
              onReact={handleReact}
              onBack={() => setSelectedConvId(null)}
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
    </div>
  );
}