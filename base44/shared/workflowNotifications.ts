export async function createNotificationIdempotently(
  notificationEntity: any,
  notification: Record<string, unknown> & { id: string },
) {
  try {
    await notificationEntity.create(notification);
    return { created: true, duplicate: false };
  } catch (createError) {
    let existing = null;
    try {
      existing = await notificationEntity.get(notification.id);
    } catch {
      // Fall through and preserve the original create failure.
    }
    if (existing) {
      return { created: false, duplicate: true };
    }
    throw createError;
  }
}
