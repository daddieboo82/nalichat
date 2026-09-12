import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUser } from '../../shared/webPush.ts';
import { workflowEntityRecordId, workflowRecordIsFresh } from '../../shared/workflowEvents.ts';
import { createNotificationIdempotently } from '../../shared/workflowNotifications.ts';
import { claimFixedWindow } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    const record = workflowEntityRecordId({ event, data });
    if (record.conflict) return Response.json({ error: 'Conflicting entity ids' }, { status: 400 });
    if (event?.type !== 'create' || !record.id) return Response.json({ success: true });

    const entities = base44.asServiceRole.entities;
    const file = await entities.SharedFile.get(record.id);
    if (!file || !workflowRecordIsFresh(file, 'create')) {
      return Response.json({ success: true, count: 0, skipped: 'stale_workflow_record' });
    }
    const eventClaim = await claimFixedWindow(
      entities,
      `workflow-file:${file.id}`,
      10,
    );
    if (!eventClaim.allowed) {
      return Response.json({ success: true, count: 0, skipped: 'already_processed' });
    }
    if (!file?.project_id) return Response.json({ success: true });
    const project = await entities.Project.get(file.project_id);
    if (!project) return Response.json({ success: true });

    const recipients = new Set<string>();
    if (project.owner_id && project.owner_id !== file.uploader_id) recipients.add(project.owner_id);
    for (const id of project.collaborator_ids || []) {
      if (id !== file.uploader_id) recipients.add(id);
    }

    let created = 0;
    for (const recipientId of recipients) {
      const notification = {
        id: `notification_file_${file.id}_${recipientId}`,
        recipient_id: recipientId,
        type: 'file',
        actor_id: file.uploader_id,
        actor_name: file.uploader_name || 'A collaborator',
        message: `uploaded a new file: ${file.name} in project "${project.title}"`,
        link: '/files',
      };
      const result = await createNotificationIdempotently(entities.Notification, notification);
      if (!result.created) continue;
      created += 1;
      try {
        await sendPushToUser(entities, recipientId, {
          title: notification.actor_name || 'NaliChat',
          body: notification.message,
          url: notification.link,
        });
      } catch (pushError) {
        console.error('File push delivery failed:', pushError);
      }
    }
    return Response.json({ success: true, count: created });
  } catch (error) {
    console.error('notifyOnFileUpload error:', error);
    return Response.json({ error: 'Workflow processing failed' }, { status: 500 });
  }
});
