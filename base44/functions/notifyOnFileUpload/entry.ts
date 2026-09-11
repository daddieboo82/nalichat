import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUser } from '../../shared/webPush.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    
    if (event.type !== 'create') return Response.json({ success: true });
    if (!data.project_id) return Response.json({ success: true }); // Only for project files
    
    // Get project to find collaborators
    const project = await base44.asServiceRole.entities.Project.get(data.project_id);
    if (!project) return Response.json({ success: true });
    
    // Determine recipients (owner + collaborators, excluding uploader)
    const recipients = new Set();
    if (project.owner_id && project.owner_id !== data.uploader_id) recipients.add(project.owner_id);
    if (project.collaborator_ids) {
      project.collaborator_ids.forEach(id => {
        if (id !== data.uploader_id) recipients.add(id);
      });
    }
    
    const notifications = Array.from(recipients).map(recipient_id => ({
      recipient_id,
      type: "file",
      actor_id: data.uploader_id,
      actor_name: data.uploader_name || "A collaborator",
      message: `uploaded a new file: ${data.name} in project "${project.title}"`,
      link: `/files`
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});