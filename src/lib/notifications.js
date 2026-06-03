import { base44 } from "@/api/base44Client";

// Create a notification for a recipient. Skips self-notifications.
export async function notify({ recipientId, actor, type, message, link }) {
  if (!recipientId || !actor || recipientId === actor.id) return;
  await base44.entities.Notification.create({
    recipient_id: recipientId,
    type,
    actor_id: actor.id,
    actor_name: actor.display_name || actor.full_name,
    actor_avatar: actor.avatar_url,
    message,
    link,
    read: false,
  });
}