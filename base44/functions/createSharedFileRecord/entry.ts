import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { hasPaidTierAccess, normalizePlan, normalizeStatus } from '../../shared/subscription.ts';

const FREE_FILE_LIMIT = 250 * 1024 * 1024;
const PREMIUM_FILE_LIMIT = 20 * 1024 * 1024 * 1024;

async function hasLargeUploadAccess(entities: any, userId: string): Promise<boolean> {
  const subscriptions = await entities.Subscription.filter({ user_id: userId });
  const now = new Date().toISOString();
  return subscriptions.some((subscription: any) => (
    normalizePlan(subscription.plan) !== 'free'
    && hasPaidTierAccess(normalizeStatus(subscription.status), {
      currentPeriodEnd: subscription.current_period_end || null,
      trialEndDate: subscription.trial_end_date || null,
      now,
    })
  ));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body?.name || !body?.file_url) {
      return Response.json({ error: 'name and file_url are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const fileSize = Number.isFinite(Number(body.file_size)) ? Number(body.file_size) : 0;
    if (fileSize > PREMIUM_FILE_LIMIT) {
      return Response.json({ error: 'Files larger than 20GB are not supported' }, { status: 413 });
    }
    if (fileSize > FREE_FILE_LIMIT && !(await hasLargeUploadAccess(entities, user.id))) {
      return Response.json({ error: 'Premium is required for files larger than 250MB' }, { status: 403 });
    }

    let accessUserIds = [user.id];
    let editUserIds = [user.id];

    if (body.project_id) {
      const project = await entities.Project.get(body.project_id);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
      if (!canEdit) {
        return Response.json({ error: 'Viewer access cannot add project files' }, { status: 403 });
      }
      accessUserIds = Array.from(new Set([
        project.owner_id,
        ...(project.collaborator_ids || []),
        user.id,
      ].filter(Boolean)));
      editUserIds = Array.from(new Set([
        project.owner_id,
        ...(project.editor_ids || []),
        user.id,
      ].filter(Boolean)));
    }

    const file = await entities.SharedFile.create({
      name: String(body.name).slice(0, 255),
      file_url: String(body.file_url),
      file_type: String(body.file_type || 'other').slice(0, 50),
      file_size: fileSize || undefined,
      uploader_id: user.id,
      uploader_name: user.display_name || user.full_name || user.email || 'User',
      description: typeof body.description === 'string' ? body.description.slice(0, 1000) : '',
      folder_id: body.folder_id || null,
      project_id: body.project_id || null,
      access_user_ids: accessUserIds,
      edit_user_ids: editUserIds,
    });

    return Response.json({ success: true, file });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not create shared file' }, { status: 500 });
  }
});
