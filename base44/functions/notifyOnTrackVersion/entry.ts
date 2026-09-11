import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUser } from '../../shared/webPush.ts';
import { workflowEntityRecordId } from '../../shared/workflowEvents.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    const record = workflowEntityRecordId({ event, data });
    if (record.conflict) return Response.json({ error: 'Conflicting entity ids' }, { status: 400 });
    if (event?.type !== 'create' || !record.id) return Response.json({ success: true });

    const entities = base44.asServiceRole.entities;
    const version = await entities.TrackVersion.get(record.id);
    if (!version?.project_id) return Response.json({ success: true });
    const project = await entities.Project.get(version.project_id);
    if (!project) return Response.json({ success: true });

    const recipients = new Set<string>();
    if (project.owner_id && project.owner_id !== version.saved_by_id) recipients.add(project.owner_id);
    for (const id of project.collaborator_ids || []) {
      if (id !== version.saved_by_id) recipients.add(id);
    }

    const label = version.label ? ` "${version.label}"` : '';
    let created = 0;
    for (const recipientId of recipients) {
      const notification = {
        id: `notification_track_version_${version.id}_${recipientId}`,
        recipient_id: recipientId,
        type: 'file',
        actor_id: version.saved_by_id,
        actor_name: version.saved_by_name || 'A collaborator',
        message: `uploaded a new track version (v${version.version_number})${label} in project "${project.title}"`,
        link: `/studio?room=${version.project_id}`,
      };
      try {
        await entities.Notification.create(notification);
        created += 1;
        await sendPushToUser(entities, recipientId, {
          title: notification.actor_name || 'NaliChat',
          body: notification.message,
          url: notification.link,
        });
      } catch {}
    }

    return Response.json({ success: true, count: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
