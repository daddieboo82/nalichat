const CONVERSATION_MEMBERSHIP_LOCK_TTL_MS = 5 * 60 * 1000;

export async function acquireConversationMembershipLock(
  entities: any,
  conversationId: string,
) {
  const id = `conversation_membership_lock_${conversationId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONVERSATION_MEMBERSHIP_LOCK_TTL_MS).toISOString();

  const create = () => entities.ConversationMembershipLock.create({
    id,
    conversation_id: conversationId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.ConversationMembershipLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.ConversationMembershipLock.delete(id).catch(() => {});
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.ConversationMembershipLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseConversationMembershipLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return;
  await entities.ConversationMembershipLock.delete(lockId).catch(() => {});
}
