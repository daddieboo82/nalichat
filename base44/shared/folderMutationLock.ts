const FOLDER_LOCK_TTL_MS = 5 * 60 * 1000;

export async function acquireFolderMutationLock(
  entities: any,
  folderId: string,
) {
  const id = `folder_mutation_lock_${folderId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + FOLDER_LOCK_TTL_MS).toISOString();

  const create = () => entities.FolderMutationLock.create({
    id,
    folder_id: folderId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.FolderMutationLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.FolderMutationLock.delete(id);
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.FolderMutationLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseFolderMutationLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return true;
  try {
    await entities.FolderMutationLock.delete(lockId);
    return true;
  } catch (error) {
    console.error('Failed to release folder mutation lock:', { lockId, error });
    return false;
  }
}
