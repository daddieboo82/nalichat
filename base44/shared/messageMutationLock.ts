const MESSAGE_MUTATION_LOCK_TTL_MS = 2 * 60 * 1000;

export async function acquireMessageMutationLock(
  entities: any,
  messageId: string,
) {
  const id = `message_mutation_lock_${messageId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MESSAGE_MUTATION_LOCK_TTL_MS).toISOString();

  const create = () => entities.MessageMutationLock.create({
    id,
    message_id: messageId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.MessageMutationLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.MessageMutationLock.delete(id).catch(() => {});
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.MessageMutationLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseMessageMutationLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return;
  await entities.MessageMutationLock.delete(lockId).catch(() => {});
}
