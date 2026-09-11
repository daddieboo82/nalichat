import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUser } from '../../shared/webPush.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'create') return Response.json({ success: true });
    if (!data.project_id) return Response.json({ success: true });

    let project;
    try {
      project = await base44.asServiceRole.entities.Project.get(data.project_id);
    } catch {
      return Response.json({ success: true }); // project no longer exists
    }
    if (!project) return Response.json({ success: true });

    // Notify owner + collaborators, excluding the uploader
    const recipients = new Set();
    if (project.owner_id && project.owner_id !== data.saved_by_id) recipients.add(project.owner_id);
    if (project.collaborator_ids) {
      project.collaborator_ids.forEach(id => {
        if (id !== data.saved_by_id) recipients.add(id);
      });
    }

    const versionLabel = data.label ? ` "${data.label}"` : '';
    const notifications = Array.from(recipients).map(recipient_id => ({
      recipient_id,
      type: 'file',
      actor_id: data.saved_by_id,
      actor_name: data.saved_by_name || 'A collaborator',
      message: `uploaded a new track version (v${data.version_number})${versionLabel} in project "${project.title}"`,
      link: `/studio?room=${data.project_id}`,
    }));

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
      await Promise.all(notifications.map((notification) =>
        sendPushToUser(base44.asServiceRole.entities, notification.recipient_id, {
          title: notification.actor_name || 'NaliChat',
          body: notification.message,
          url: notification.link,
        })
      ));
    }

    return Response.json({ success: true, count: notifications.length });
  } catch (error) {
    console.error('notifyOnTrackVersion error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});