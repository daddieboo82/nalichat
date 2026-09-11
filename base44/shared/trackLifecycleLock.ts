const TRACK_LIFECYCLE_LOCK_TTL_MS = 5 * 60 * 1000;

export async function acquireTrackLifecycleLock(
  entities: any,
  trackId: string,
) {
  const id = `track_lifecycle_lock_${trackId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRACK_LIFECYCLE_LOCK_TTL_MS).toISOString();

  const create = () => entities.TrackLifecycleLock.create({
    id,
    track_id: trackId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.TrackLifecycleLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.TrackLifecycleLock.delete(id).catch(() => {});
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.TrackLifecycleLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseTrackLifecycleLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return;
  await entities.TrackLifecycleLock.delete(lockId).catch(() => {});
}
