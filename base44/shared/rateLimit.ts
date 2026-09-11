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
    const rows = await entities.UsageRateLimit.filter({ id });
    const row = rows[0] || await entities.UsageRateLimit.get(id);
    const current = Number(row?.count || 0);
    if (current >= limit) {
      return { allowed: false, count: current, limit };
    }

    await entities.UsageRateLimit.updateMany(
      { id },
      { $inc: { count: 1 } },
    );
    return { allowed: true, count: current + 1, limit };
  }
}
