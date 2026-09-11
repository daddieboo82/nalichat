import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUser } from '../../shared/webPush.ts';
import { workflowEntityRecordId } from '../../shared/workflowEvents.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, changed_fields } = await req.json();
    const record = workflowEntityRecordId({ event, data });
    if (record.conflict) return Response.json({ error: 'Conflicting entity ids' }, { status: 400 });
    if (event?.type !== 'update' || !record.id) return Response.json({ success: true });

    const changedFields = Array.isArray(changed_fields)
      ? changed_fields
      : Array.isArray(event?.changed_fields)
        ? event.changed_fields
        : null;
    if (
      changedFields
      && !changedFields.some((field) => ['completed', 'due_date', 'title'].includes(field))
    ) {
      return Response.json({ success: true, message: 'No relevant fields changed' });
    }

    const entities = base44.asServiceRole.entities;
    const milestone = await entities.Milestone.get(record.id);
    if (!milestone?.project_id) return Response.json({ success: true });
    const project = await entities.Project.get(milestone.project_id);
    if (!project) return Response.json({ success: true });

    const versionKey = String(milestone.updated_date || milestone.completed_at || milestone.due_date || 'update')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const recipients = new Set<string>([
      ...(project.owner_id ? [project.owner_id] : []),
      ...(project.collaborator_ids || []),
    ]);

    let created = 0;
    for (const recipientId of recipients) {
      const notification = {
        id: `notification_milestone_${milestone.id}_${versionKey}_${recipientId}`,
        recipient_id: recipientId,
        type: 'milestone',
        actor_name: 'Project Update',
        message: `Milestone "${milestone.title}" was updated in project "${project.title}"`,
        link: '/projects-summary',
      };
      try {
        await entities.Notification.create(notification);
        created += 1;
        await sendPushToUser(entities, recipientId, {
          title: notification.actor_name,
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
