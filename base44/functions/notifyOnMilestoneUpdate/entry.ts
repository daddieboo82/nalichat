import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, changed_fields } = await req.json();
    
    if (event.type !== 'update') return Response.json({ success: true });
    if (!data.project_id) return Response.json({ success: true });
    
    // We only care if relevant fields changed
    if (!changed_fields || (!changed_fields.includes('completed') && !changed_fields.includes('due_date') && !changed_fields.includes('title'))) {
      return Response.json({ success: true, message: 'No relevant fields changed' });
    }
    
    const project = await base44.asServiceRole.entities.Project.get(data.project_id);
    if (!project) return Response.json({ success: true });
    
    const recipients = new Set();
    if (project.owner_id) recipients.add(project.owner_id);
    if (project.collaborator_ids) {
      project.collaborator_ids.forEach(id => recipients.add(id));
    }
    
    const notifications = Array.from(recipients).map(recipient_id => ({
      recipient_id,
      type: "milestone",
      actor_name: "Project Update",
      message: `Milestone "${data.title}" was updated in project "${project.title}"`,
      link: `/projects-summary`
    }));
    
    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }
    
    return Response.json({ success: true, count: notifications.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});