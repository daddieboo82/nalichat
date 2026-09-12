import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { sendPushToUser } from '../../shared/webPush.ts';
import { workflowEntityRecordId, workflowRecordIsFresh } from '../../shared/workflowEvents.ts';
import { createNotificationIdempotently } from '../../shared/workflowNotifications.ts';
import { claimFixedWindow } from '../../shared/rateLimit.ts';
import { validWorkflowKey } from '../../shared/workflowAuth.ts';

const WORKFLOW_KEY_SHA256 = 'f048617eea7b69a5909950f1254fd1c7142d40cfaf57d9d68a799d82d218a62f';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const { event, data, workflow_key } = await readJsonBodyLimited(req, 64 * 1024);
    if (!(await validWorkflowKey(workflow_key, WORKFLOW_KEY_SHA256))) {
      return Response.json({ error: 'Forbidden: invalid workflow credential' }, { status: 403 });
    }
    const record = workflowEntityRecordId({ event, data });
    if (record.invalid) return Response.json({ error: 'Invalid entity id' }, { status: 400 });
    if (record.conflict) return Response.json({ error: 'Conflicting entity ids' }, { status: 400 });
    if (event?.type !== 'create' || !record.id) return Response.json({ success: true });

    const entities = base44.asServiceRole.entities;
    const version = await entities.TrackVersion.get(record.id);
    if (!version || !workflowRecordIsFresh(version, 'create')) {
      return Response.json({ success: true, count: 0, skipped: 'stale_workflow_record' });
    }
    const eventClaim = await claimFixedWindow(
      entities,
      `workflow-track-version:${version.id}`,
      10,
    );
    if (!eventClaim.allowed) {
      return Response.json({ success: true, count: 0, skipped: 'already_processed' });
    }
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
        console.error('Track-version push delivery failed:', pushError);
      }
    }

    return Response.json({ success: true, count: created });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('notifyOnTrackVersion error:', error);
    return Response.json({ error: 'Workflow processing failed' }, { status: 500 });
  }
});
