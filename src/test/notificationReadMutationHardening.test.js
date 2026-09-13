import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('notification read mutation hardening', () => {
  it('updates only the current user notifications server-side', async () => {
    const fn = await readFile('base44/functions/markNotificationsRead/entry.ts', 'utf8');
    expect(fn).toContain("req.method !== 'POST'");
    expect(fn).toContain("if (user.is_banned)");
    expect(fn).toContain("'notification_mark_read'");
    expect(fn).toContain("{ recipient_id: user.id }");
    expect(fn).toContain("{ $set: { read: true } }");
  });

  it('routes NotificationBell through the backend instead of direct entity updates', async () => {
    const bell = await readFile('src/components/notifications/NotificationBell.jsx', 'utf8');
    expect(bell).toContain('base44.functions.invoke("markNotificationsRead", {})');
    expect(bell).toContain('result?.data?.action !== "mark_notifications_read"');
    expect(bell).toContain('result?.data?.userId !== userId');
    expect(bell).not.toContain('base44.entities.Notification.update(n.id, { read: true })');
  });
});


describe('notification read response binding', () => {
  it('binds mark-read responses to the authenticated user', async () => {
    const backend = await readFile('base44/functions/markNotificationsRead/entry.ts', 'utf8');
    expect(backend).toContain("action: 'mark_notifications_read'");
    expect(backend).toContain('userId: user.id');
  });
});
