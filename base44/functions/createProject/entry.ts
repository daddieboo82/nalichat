import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const creationRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'project_create',
      60,
    );
    if (!creationRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const body = await req.json();
    const title = String(body?.title || '').trim().slice(0, 200);
    const description = String(body?.description || '').trim().slice(0, 3000);

    if (!title) return Response.json({ error: 'Project title is required' }, { status: 400 });

    const project = await base44.asServiceRole.entities.Project.create({
      title,
      description,
      owner_id: user.id,
      collaborator_ids: [],
      collaborator_roles: {},
      editor_ids: [],
      status: 'draft',
    });

    return Response.json({ success: true, project });
  } catch (error) {
    console.error('createProject error:', error);
    return Response.json({ error: error?.message || 'Could not create project' }, { status: 500 });
  }
});
