const CALL_SUMMARY_START_LOCK_TTL_MS = 5 * 60 * 1000;

async function callStartLockId(callId: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(callId),
  );
  const suffix = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `call_summary_start_${suffix}`;
}

export async function acquireCallSummaryStartLock(
  entities: any,
  callId: string,
) {
  const id = await callStartLockId(callId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CALL_SUMMARY_START_LOCK_TTL_MS).toISOString();

  const create = () => entities.CallSummaryStartLock.create({
    id,
    call_id: callId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.CallSummaryStartLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.CallSummaryStartLock.delete(id).catch(() => {});
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.CallSummaryStartLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseCallSummaryStartLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return;
  await entities.CallSummaryStartLock.delete(lockId).catch(() => {});
}
