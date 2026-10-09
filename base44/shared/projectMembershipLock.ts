const MEMBERSHIP_LOCK_TTL_MS = 5 * 60 * 1000;

export async function acquireProjectMembershipLock(
  entities: any,
  projectId: string,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MEMBERSHIP_LOCK_TTL_MS).toISOString();

  // Base44 generates the entity record ID even when an id is supplied in the
  // create payload. Return the real record ID so release() deletes the lock.
  const existingRows = await entities.ProjectMembershipLock.filter(
    { project_id: projectId },
    '-created_date',
    20,
    0,
  );
  const active = existingRows.find(
    (row: any) => Date.parse(row.expires_at || '') > now.getTime(),
  );
  if (active) return null;

  for (const row of existingRows) {
    if (!row?.id) continue;
    try {
      await entities.ProjectMembershipLock.delete(row.id);
    } catch (error) {
      console.error('Failed to clean expired project membership lock:', { lockId: row.id, error });
      throw error;
    }
  }

  const created = await entities.ProjectMembershipLock.create({
    project_id: projectId,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
  });
  return created?.id || null;
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
