const PLAYLIST_MUTATION_LOCK_TTL_MS = 2 * 60 * 1000;

export async function acquirePlaylistMutationLock(
  entities: any,
  playlistId: string,
) {
  const id = `playlist_mutation_lock_${playlistId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PLAYLIST_MUTATION_LOCK_TTL_MS).toISOString();

  const create = () => entities.PlaylistMutationLock.create({
    id,
    playlist_id: playlistId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.PlaylistMutationLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.PlaylistMutationLock.delete(id);
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.PlaylistMutationLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releasePlaylistMutationLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return true;
  try {
    await entities.PlaylistMutationLock.delete(lockId);
    return true;
  } catch (error) {
    console.error('Failed to release playlist mutation lock:', { lockId, error });
    return false;
  }
}
