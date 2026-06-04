import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import ConversationList from "@/components/messages/ConversationList";
import ChatView from "@/components/messages/ChatView";
import NewChatDialog from "@/components/messages/NewChatDialog";
import GroupChatDialog from "@/components/messages/GroupChatDialog";
import ExternalMessageDialog from "@/components/messages/ExternalMessageDialog";
import InviteTab from "@/components/messages/InviteTab";
import ContactsTab from "@/components/messages/ContactsTab";
import { notify } from "@/lib/notifications";
import { MessageSquare, Users, Mail, Plus, Zap, UserPlus, Hash } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function Messages() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showExternal, setShowExternal] = useState(false);
  const [activeTab, setActiveTab] = useState("chats");
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Update online status when page becomes visible/hidden
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const isOnline = document.visibilityState === "visible";
      if (currentUser) {
        try {
          await base44.functions.invoke("updateUserPresence", { isOnline });
        } catch (err) {
          console.warn("Failed to update presence:", err.message);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Mark as online when component mounts
    if (currentUser) {
      base44.functions.invoke("updateUserPresence", { isOnline: true }).catch(err => 
        console.warn("Failed to mark as online:", err.message)
      );
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

  const myConversations = conversations.filter(c =>
    c.participant_ids?.includes(currentUser?.id)
  );

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", selectedConvId],
    queryFn: () => base44.entities.Message.filter({ conversation_id: selectedConvId }, "created_date", 300),
    enabled: !!selectedConvId,
    refetchInterval: 5000,
  });

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.data?.conversation_id === selectedConvId) {
        queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
    return unsub;
  }, [selectedConvId, queryClient]);

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
      // Notify recipients when a file/audio/session is sent
      const conv = queryClient.getQueryData(["conversations"])?.find(c => c.id === selectedConvId);
      if (["file", "audio", "session", "image"].includes(msgData.type) && conv) {
        const recipients = (conv.participant_ids || []).filter(id => id !== currentUser.id);
        await Promise.all(recipients.map(rid => notify({
          recipientId: rid,
          actor: currentUser,
          type: "file",
          message: `sent you a file: ${msgData.file_name || msgData.type}`,
          link: "/messages",
        })));
      }
      return msg;
    },
    // Optimistically append the message so it appears instantly
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
    // Store per-user keys directly so toggling survives reloads.
    // Display counts are aggregated in the message component.
    const reactions = { ...(msg.reactions || {}) };
    const userKey = `${emoji}__${currentUser.id}`;
    if (reactions[userKey]) {
      delete reactions[userKey];
    } else {
      reactions[userKey] = emoji;
    }
    // Optimistically flip the reaction in the cache before the request resolves
    const previous = queryClient.getQueryData(["messages", selectedConvId]);
    queryClient.setQueryData(["messages", selectedConvId], (old = []) =>
      old.map(m => (m.id === messageId ? { ...m, reactions } : m))
    );
    try {
      await base44.entities.Message.update(messageId, { reactions });
    } catch (err) {
      if (previous) queryClient.setQueryData(["messages", selectedConvId], previous);
      throw err;
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
    } catch (err) {
      console.error("Failed to start DM:", err);
    }
  };

  const joinMainRoom = async () => {
    if (!currentUser?.id) return;
    try {
      const existing = conversations.find(c => c.name === "Main Chat Room" && c.type === "group");
      if (existing) {
        if (!existing.participant_ids?.includes(currentUser.id)) {
          await base44.entities.Conversation.update(existing.id, {
            participant_ids: [...new Set([...(existing.participant_ids || []), currentUser.id])]
          });
          await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
        setSelectedConvId(existing.id);
      } else {
        const conv = await base44.entities.Conversation.create({
          type: "group",
          name: "Main Chat Room",
          participant_ids: [currentUser.id]
        });
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        setSelectedConvId(conv.id);
      }
    } catch (err) {
      console.error("Failed to join main room:", err);
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
      // Notify invited members about the new session/group
      await Promise.all(participant_ids.map(rid => notify({
        recipientId: rid,
        actor: currentUser,
        type: "session_invite",
        message: `invited you to the session "${name || "Untitled"}"`,
        link: "/messages",
      }).catch(err => console.warn("Notification failed:", err))));
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedConvId(conv.id);
    } catch (err) {
      console.error("Failed to create group:", err);
    }
  };

  const selectedConv = myConversations.find(c => c.id === selectedConvId);

  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  const quickActions = [
    { icon: Hash, label: "Main Room", action: joinMainRoom, color: "from-purple-500 to-indigo-500", bg: "bg-purple-500/10", text: "text-purple-500" },
    { icon: MessageSquare, label: "Direct Message", action: () => setShowNewDM(true), color: "from-primary to-pink-500", bg: "bg-primary/10", text: "text-primary" },
    { icon: Users, label: "New Group", action: () => setShowNewGroup(true), color: "from-accent to-cyan-400", bg: "bg-accent/10", text: "text-accent" },
    { icon: Zap, label: "Email / SMS", action: () => setShowExternal(true), color: "from-yellow-500 to-orange-500", bg: "bg-yellow-500/10", text: "text-yellow-500" },
  ];

  return (
    <div className="h-full flex overflow-hidden flex-col sm:flex-row">
      {/* Sidebar with conversation list — hidden on mobile when a chat is open */}
      <div className={cn(
        "shrink-0 transition-all flex flex-col",
        selectedConvId ? "hidden sm:flex" : "flex w-full sm:w-[320px]"
      )}>
        {/* Tabs for Chats, Contacts, and Invite */}
        {!selectedConvId && (
          <div className="px-4 pt-5 pb-3 border-b border-border/40">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chats">Chats</TabsTrigger>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="invite">Invite</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}
        
        {/* Quick Actions Header and Conversation List (Chats Tab) */}
        {activeTab === "chats" && !selectedConvId && (
          <>
            <div className="px-4 pt-5 pb-4 border-b border-border/40" style={{ background: "hsl(240 10% 5%)" }}>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">Start Chatting</h3>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        onClick={action.action}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:scale-105 active:scale-95 ${action.bg}`}
                        title={action.label}
                      >
                        <Icon className={`w-5 h-5 ${action.text}`} />
                        <span className="text-xs font-medium text-center text-foreground/80">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
            
            {/* Conversation List */}
            <div className="flex-1 overflow-hidden">
              <ConversationList
                conversations={myConversations}
                selectedId={selectedConvId}
                onSelect={setSelectedConvId}
                onNewDM={() => setShowNewDM(true)}
                onNewGroup={() => setShowNewGroup(true)}
                onNewExternal={() => setShowExternal(true)}
                users={users}
                currentUserId={currentUser?.id}
              />
            </div>
          </>
        )}

        {/* Contacts Tab */}
         {activeTab === "contacts" && !selectedConvId && (
           <ContactsTab
             currentUserId={currentUser?.id}
             onMessageContact={(userId) => {
               const user = users.find(u => u.id === userId);
               if (user) startDM(user);
             }}
           />
         )}

         {/* Invite Tab */}
         {activeTab === "invite" && !selectedConvId && (
           <div className="flex-1 overflow-hidden">
             <InviteTab />
           </div>
         )}
        </div>

      {/* Chat view — full width on mobile */}
      <div className={cn("flex-1 overflow-hidden flex flex-col", !selectedConvId && "hidden sm:flex")}>
        {selectedConv ? (
          <ChatView
            conversation={selectedConv}
            messages={messages}
            currentUser={currentUser}
            users={users}
            onSendMessage={(data) => sendMessage.mutate(data)}
            onReact={handleReact}
            onBack={() => setSelectedConvId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-center text-muted-foreground gap-4 px-6">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-12 h-12 text-primary/30" />
            </div>
            <div>
              <p className="text-lg font-heading font-semibold mb-2">Select a conversation</p>
              <p className="text-sm text-muted-foreground/70">Choose a chat from the left or create a new one to get started</p>
            </div>
          </div>
        )}
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