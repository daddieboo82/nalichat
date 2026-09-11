const CHALLENGE_LOCK_TTL_MS = 5 * 60 * 1000;

export async function acquireChallengeLifecycleLock(
  entities: any,
  challengeId: string,
) {
  const id = `challenge_lifecycle_lock_${challengeId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_LOCK_TTL_MS).toISOString();

  const create = () => entities.ChallengeLifecycleLock.create({
    id,
    challenge_id: challengeId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.ChallengeLifecycleLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.ChallengeLifecycleLock.delete(id).catch(() => {});
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.ChallengeLifecycleLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseChallengeLifecycleLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return;
  await entities.ChallengeLifecycleLock.delete(lockId).catch(() => {});
}
