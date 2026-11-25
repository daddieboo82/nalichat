// The member-scoped entity query can briefly lag behind a confirmed
// service-role conversation creation. Retain only recently confirmed DMs
// until the server begins returning them; never retain indefinitely.
export const PENDING_CONVERSATION_MAX_AGE_MS = 30_000;

export function reconcilePendingConversations(serverRows, pending, userId, now = Date.now()) {
  const rows = Array.isArray(serverRows) ? serverRows : [];
  const presentIds = new Set(rows.map(row => row?.id));
  const extra = [];
  for (const [id, item] of pending) {
    if (item?.userId !== userId) continue;
    // A previous account's delayed fetch must not clear the new account's
    // pending entry. Account-switch cleanup owns removal across identities.
    if (now - item.createdAt >= PENDING_CONVERSATION_MAX_AGE_MS || presentIds.has(id)) {
      pending.delete(id);
      continue;
    }
    if (item.conversation?.type === 'dm' && item.conversation.participant_ids?.includes(userId)) {
      extra.push(item.conversation);
    } else {
      pending.delete(id);
    }
  }
  return extra.length ? [...extra, ...rows] : rows;
}
