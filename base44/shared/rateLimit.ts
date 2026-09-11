function hourWindow(date = new Date()) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  const key = d.toISOString();
  const expires = new Date(d.getTime() + 2 * 60 * 60 * 1000).toISOString();
  return { key, expires };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function consumeHourlyLimit(
  entities: any,
  userId: string,
  action: string,
  limit: number,
) {
  const { key, expires } = hourWindow();
  const id = 'usage_' + await sha256Hex(`${userId}:${action}:${key}`);

  try {
    await entities.UsageRateLimit.create({
      id,
      user_id: userId,
      action,
      window_key: key,
      count: 1,
      expires_at: expires,
    });
    return { allowed: true, count: 1, limit };
  } catch {
    // Atomically claim one remaining slot. A read-then-increment sequence lets
    // concurrent requests all observe the same count and overshoot the cap.
    const update = await entities.UsageRateLimit.updateMany(
      { id, count: { $lt: limit } },
      { $inc: { count: 1 } },
    );

    if (Number(update?.updated || 0) > 0) {
      const row = await entities.UsageRateLimit.get(id);
      return { allowed: true, count: Number(row?.count || 0), limit };
    }

    const row = await entities.UsageRateLimit.get(id);
    return { allowed: false, count: Number(row?.count || limit), limit };
  }
}
