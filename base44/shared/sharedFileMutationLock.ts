const SHARED_FILE_LOCK_TTL_MS = 5 * 60 * 1000;

export async function acquireSharedFileMutationLock(
  entities: any,
  fileId: string,
) {
  const id = `shared_file_lock_${fileId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SHARED_FILE_LOCK_TTL_MS).toISOString();

  const create = () => entities.SharedFileMutationLock.create({
    id,
    file_id: fileId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.SharedFileMutationLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.SharedFileMutationLock.delete(id);
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.SharedFileMutationLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseSharedFileMutationLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return true;
  try {
    await entities.SharedFileMutationLock.delete(lockId);
    return true;
  } catch (error) {
    console.error('Failed to release shared file mutation lock:', { lockId, error });
    return false;
  }
}
