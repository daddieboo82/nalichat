import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConversationList from "@/components/messages/ConversationList";
import ChatView from "@/components/messages/ChatView";
import NewChatDialog from "@/components/messages/NewChatDialog";

export default function Messages() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
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
    queryFn: () => base44.entities.Message.filter({ conversation_id: selectedConvId }, "created_date", 200),
    enabled: !!selectedConvId,
  });

  // Subscribe to real-time messages
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
      return msg;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const startConversation = async (otherUser) => {
    // Check if conversation already exists
    const existing = myConversations.find(c =>
      c.type === "dm" && c.participant_ids?.includes(otherUser.id)
    );
    if (existing) {
      setSelectedConvId(existing.id);
      return;
    }
    const conv = await base44.entities.Conversation.create({
      type: "dm",
      participant_ids: [currentUser.id, otherUser.id],
    });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setSelectedConvId(conv.id);
  };

  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  return (
    <div className="h-full flex">
      <ConversationList
        conversations={myConversations}
        selectedId={selectedConvId}
        onSelect={setSelectedConvId}
        onNewChat={() => setShowNewChat(true)}
        users={users}
        currentUserId={currentUser?.id}
      />
      <ChatView
        conversation={myConversations.find(c => c.id === selectedConvId)}
        messages={messages}
        currentUser={currentUser}
        users={users}
        onSendMessage={(data) => sendMessage.mutate(data)}
      />
      <NewChatDialog
        open={showNewChat}
        onOpenChange={setShowNewChat}
        users={otherUsers}
        onSelectUser={startConversation}
      />
    </div>
  );
}