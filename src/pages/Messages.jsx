import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConversationList from "@/components/messages/ConversationList";
import ChatView from "@/components/messages/ChatView";
import NewChatDialog from "@/components/messages/NewChatDialog";
import GroupChatDialog from "@/components/messages/GroupChatDialog";
import ExternalMessageDialog from "@/components/messages/ExternalMessageDialog";
import { notify } from "@/lib/notifications";

export default function Messages() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showExternal, setShowExternal] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

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
      if (["file", "audio", "session", "image"].includes(msgData.type) && selectedConv) {
        const recipients = (selectedConv.participant_ids || []).filter(id => id !== currentUser.id);
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
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
    const existing = myConversations.find(c =>
      c.type === "dm" && c.participant_ids?.includes(otherUser.id) && c.participant_ids?.length === 2
    );
    if (existing) { setSelectedConvId(existing.id); return; }
    const conv = await base44.entities.Conversation.create({
      type: "dm",
      participant_ids: [currentUser.id, otherUser.id],
    });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setSelectedConvId(conv.id);
  };

  const createGroup = async ({ name, participant_ids }) => {
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
    })));
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setSelectedConvId(conv.id);
  };

  const selectedConv = myConversations.find(c => c.id === selectedConvId);

  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Conversation list — hidden on mobile when a chat is open */}
      <div className={cn(
        "shrink-0 transition-all",
        selectedConvId ? "hidden sm:flex" : "flex w-full sm:w-auto"
      )}>
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

      {/* Chat view — full width on mobile */}
      <div className={cn("flex-1 overflow-hidden", !selectedConvId && "hidden sm:flex")}>
        <ChatView
          conversation={selectedConv}
          messages={messages}
          currentUser={currentUser}
          users={users}
          onSendMessage={(data) => sendMessage.mutate(data)}
          onReact={handleReact}
          onBack={() => setSelectedConvId(null)}
        />
      </div>
      <NewChatDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        users={otherUsers}
        onSelectUser={(u) => { startDM(u); setShowNewDM(false); }}
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