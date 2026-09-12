const MEMBERSHIP_LOCK_TTL_MS = 5 * 60 * 1000;

export async function acquireProjectMembershipLock(
  entities: any,
  projectId: string,
) {
  const id = `project_membership_lock_${projectId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MEMBERSHIP_LOCK_TTL_MS).toISOString();

  const create = () => entities.ProjectMembershipLock.create({
    id,
    project_id: projectId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });

  try {
    await create();
    return id;
  } catch (createError) {
    const existing = await entities.ProjectMembershipLock.get(id).catch(() => null);
    if (!existing) throw createError;

    const expired = Date.parse(existing.expires_at || '') <= now.getTime();
    if (!expired) return null;

    await entities.ProjectMembershipLock.delete(id);
    try {
      await create();
      return id;
    } catch (retryError) {
      const raced = await entities.ProjectMembershipLock.get(id).catch(() => null);
      if (raced) return null;
      throw retryError;
    }
  }
}

export async function releaseProjectMembershipLock(
  entities: any,
  lockId: string | null,
) {
  if (!lockId) return true;
  try {
    await entities.ProjectMembershipLock.delete(lockId);
    return true;
  } catch (error) {
    console.error('Failed to release project membership lock:', { lockId, error });
    return false;
  }
}
