const SUBMISSION_LOCK_TTL_MS = 5 * 60 * 1000;

export async function acquireChallengeSubmissionLock(
  entities: any,
  submissionId: string,
) {
  const id = `challenge_submission_lock_${submissionId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SUBMISSION_LOCK_TTL_MS).toISOString();

  const create = () => entities.ChallengeSubmissionLock.create({
    id,
    submission_id: submissionId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.ChallengeSubmissionLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.ChallengeSubmissionLock.delete(id).catch(() => {});
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.ChallengeSubmissionLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseChallengeSubmissionLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return;
  await entities.ChallengeSubmissionLock.delete(lockId).catch(() => {});
}
