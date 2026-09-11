import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
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
