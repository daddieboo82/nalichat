const ACCOUNT_DELETION_LOCK_TTL_MS = 30 * 60 * 1000;

export async function acquireAccountDeletionLock(
  entities: any,
  userId: string,
) {
  const id = `account_deletion_lock_${userId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACCOUNT_DELETION_LOCK_TTL_MS).toISOString();

  const create = () => entities.AccountDeletionLock.create({
    id,
    user_id: userId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.AccountDeletionLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.AccountDeletionLock.delete(id).catch(() => {});
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.AccountDeletionLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseAccountDeletionLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return;
  await entities.AccountDeletionLock.delete(lockId).catch(() => {});
}
