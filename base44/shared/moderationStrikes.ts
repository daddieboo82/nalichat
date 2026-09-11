export async function claimModerationStrike(entities: any, userId: string) {
  const result = await entities.User.updateMany(
    { id: userId },
    { $inc: { violation_count: 1 } },
  );
  if (Number(result?.updated || 0) !== 1) {
    throw new Error('Unable to record moderation strike');
  }

  const refreshed = await entities.User.get(userId);
  if (!refreshed) {
    throw new Error('Moderated user not found after strike claim');
  }

  return {
    user: refreshed,
    violationCount: Number(refreshed.violation_count || 0),
  };
}
