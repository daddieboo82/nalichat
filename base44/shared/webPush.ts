import webpush from 'npm:web-push@3.6.7';
import { secrets } from 'base44:runtime';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

function vapidConfig() {
  const publicKey = secrets.get('VAPID_PUBLIC_KEY') || '';
  const privateKey = secrets.get('VAPID_PRIVATE_KEY') || '';
  const subject = secrets.get('VAPID_SUBJECT') || 'https://nalichat.org';
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey) };
}

export function publicPushConfig() {
  const config = vapidConfig();
  return { configured: config.configured, publicKey: config.publicKey };
}

export async function sendPushToUser(
  entities: any,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; configured: boolean; staleCleanupFailures: number }> {
  const config = vapidConfig();
  if (!config.configured || !userId) {
    return { sent: 0, configured: false, staleCleanupFailures: 0 };
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const subscriptions: any[] = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await entities.PushSubscription.filter(
      { user_id: userId },
      '-last_seen_at',
      pageSize,
      skip,
    );
    subscriptions.push(...page);
    if (page.length < pageSize) break;
  }

  const byEndpoint = new Map<string, any>();
  for (const subscription of subscriptions) {
    if (!subscription?.endpoint || byEndpoint.has(subscription.endpoint)) continue;
    byEndpoint.set(subscription.endpoint, subscription);
  }

  let sent = 0;
  let staleCleanupFailures = 0;

  for (const subscription of byEndpoint.values()) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({
          title: payload.title || 'NaliBase',
          body: payload.body || 'You have a new notification',
          url: payload.url || '/',
        }),
        { TTL: 60 * 60 },
      );
      sent += 1;
    } catch (error) {
      const statusCode = Number(error?.statusCode || error?.status);
      if (statusCode === 404 || statusCode === 410) {
        const staleRows = subscriptions.filter((row: any) => row.endpoint === subscription.endpoint);
        for (const staleRow of staleRows) {
          try {
            await entities.PushSubscription.delete(staleRow.id);
          } catch (cleanupError) {
            staleCleanupFailures += 1;
            console.error('Failed to remove stale Web Push subscription', {
              userId,
              subscriptionId: staleRow.id,
              statusCode,
              cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            });
          }
        }
      } else {
        console.error('Web Push delivery failed', {
          userId,
          subscriptionId: subscription.id,
          statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
        });
      }
    }
  }

  return { sent, configured: true, staleCleanupFailures };
}
