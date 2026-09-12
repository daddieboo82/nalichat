const ART_POST_ENGAGEMENT_LOCK_TTL_MS = 2 * 60 * 1000;

export async function acquireArtPostEngagementLock(
  entities: any,
  postId: string,
) {
  const id = `artpost_engagement_lock_${postId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ART_POST_ENGAGEMENT_LOCK_TTL_MS).toISOString();

  const create = () => entities.ArtPostEngagementLock.create({
    id,
    post_id: postId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.ArtPostEngagementLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.ArtPostEngagementLock.delete(id);
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.ArtPostEngagementLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseArtPostEngagementLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return true;
  try {
    await entities.ArtPostEngagementLock.delete(lockId);
    return true;
  } catch (error) {
    console.error('Failed to release ArtPost engagement lock:', { lockId, error });
    return false;
  }
}
