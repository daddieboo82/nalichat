const CONVERSATION_MEMBERSHIP_LOCK_TTL_MS = 5 * 60 * 1000;

export async function acquireConversationMembershipLock(
  entities: any,
  conversationId: string,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONVERSATION_MEMBERSHIP_LOCK_TTL_MS).toISOString();

  // Base44 generates the entity record ID even when an id is supplied in the
  // create payload. The previous implementation returned a synthetic ID,
  // so release() could never delete the actual lock record. That caused
  // repeated live-session recordings to be blocked for the full TTL.
  const existingRows = await entities.ConversationMembershipLock.filter(
    { conversation_id: conversationId },
    '-created_date',
    20,
    0,
  );
  const active = existingRows.find(
    (row: any) => Date.parse(row.expires_at || '') > now.getTime(),
  );
  if (active) return null;

  for (const row of existingRows) {
    if (!row?.id) continue;
    try {
      await entities.ConversationMembershipLock.delete(row.id);
    } catch (error) {
      console.error('Failed to clean expired conversation membership lock:', { lockId: row.id, error });
      throw error;
    }
  }

  const created = await entities.ConversationMembershipLock.create({
    conversation_id: conversationId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });
  return created?.id || null;
}

export async function releaseConversationMembershipLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return true;
  try {
    await entities.ConversationMembershipLock.delete(lockId);
    return true;
  } catch (error) {
    console.error('Failed to release conversation membership lock:', { lockId, error });
    return false;
  }
}
