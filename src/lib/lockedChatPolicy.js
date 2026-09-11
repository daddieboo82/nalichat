export const LOCKED_CHAT_NOTIFICATION_MESSAGE = "New message in a locked chat.";

export function partitionUserConversations(conversations, userId, lockedConversationIds) {
  const lockedIds = new Set(lockedConversationIds);
  const mine = conversations.filter((conversation) => conversation.participant_ids?.includes(userId));
  return {
    visible: mine.filter((conversation) => !lockedIds.has(conversation.id)),
    locked: mine.filter((conversation) => lockedIds.has(conversation.id)),
  };
}

export function notificationConversationId(notification) {
  if (notification?.conversation_id) return notification.conversation_id;
  const query = notification?.link?.split("?")[1];
  return query ? new URLSearchParams(query).get("id") : null;
}

export function redactLockedChatNotification(
  notification,
  lockedConversationIds = [],
  redactAllMessages = false,
) {
  if (!notification || notification.type !== "message") return notification;
  const conversationId = notificationConversationId(notification);
  if (
    !redactAllMessages
    && !notification.locked_chat
    && !lockedConversationIds.includes(conversationId)
  ) {
    return notification;
  }
  return {
    ...notification,
    actor_id: "",
    actor_name: "Locked chat",
    actor_avatar: "",
    message: LOCKED_CHAT_NOTIFICATION_MESSAGE,
  };
}

export function countVisibleUnreadConversations(
  conversations,
  userId,
  lockedConversationIds,
  readTimestamp,
) {
  const { visible } = partitionUserConversations(conversations, userId, lockedConversationIds);
  return visible.reduce((count, conversation) => {
    if (!conversation.last_message_at) return count;
    const lastReadAt = readTimestamp(conversation.id);
    const lastMessageAt = new Date(conversation.last_message_at).getTime();
    return !lastReadAt || lastMessageAt > lastReadAt ? count + 1 : count;
  }, 0);
}

export function resolveRequestedConversation(
  conversations,
  conversationId,
  lockedConversationIds,
  vaultUnlocked,
) {
  const conversation = conversations.find((candidate) => candidate.id === conversationId);
  if (!conversation) return { status: "missing", conversation: null };
  if (lockedConversationIds.includes(conversationId) && !vaultUnlocked) {
    return { status: "locked", conversation };
  }
  return { status: "allowed", conversation };
}
