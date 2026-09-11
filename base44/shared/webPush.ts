import webpush from 'npm:web-push@3.6.7';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

function vapidConfig() {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const subject = Deno.env.get('VAPID_SUBJECT') || 'https://nalichat.org';
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
): Promise<{ sent: number; configured: boolean }> {
  const config = vapidConfig();
  if (!config.configured || !userId) return { sent: 0, configured: false };

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const subscriptions = await entities.PushSubscription.filter({ user_id: userId });
  let sent = 0;

  for (const subscription of subscriptions) {
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
          title: payload.title || 'NaliChat',
          body: payload.body || 'You have a new notification',
          url: payload.url || '/',
        }),
        { TTL: 60 * 60 },
      );
      sent += 1;
    } catch (error) {
      const statusCode = Number(error?.statusCode || error?.status);
      if (statusCode === 404 || statusCode === 410) {
        try { await entities.PushSubscription.delete(subscription.id); } catch (_) {}
      } else {
        console.error('Web Push delivery failed', {
          userId,
          subscriptionId: subscription.id,
          statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
        });
      }
    }
  }

  return { sent, configured: true };
}
