import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const projectId = body?.projectId ? String(body.projectId) : '';
    if (projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
      if (!canEdit) {
        return Response.json({ error: 'Viewer access cannot publish this shared project' }, { status: 403 });
      }
    }

    if (!body?.title || !body?.file_url) {
      return Response.json({ error: 'title and file_url are required' }, { status: 400 });
    }

    const post = await base44.asServiceRole.entities.ArtPost.create({
      title: String(body.title).slice(0, 200),
      description: String(body.description || '').slice(0, 2000),
      file_url: String(body.file_url),
      medium: String(body.medium || 'original').slice(0, 50),
      genre: String(body.genre || '').slice(0, 100),
      tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).slice(0, 64)).slice(0, 30) : [],
      is_explicit: Boolean(body.is_explicit),
      bpm: Number.isFinite(Number(body.bpm)) ? Number(body.bpm) : undefined,
      creator_id: user.id,
      creator_name: user.display_name || user.full_name || user.email || 'User',
      creator_avatar: user.avatar_url || null,
      featured: false,
      likes: 0,
      views: 0,
    });

    return Response.json({ success: true, post });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not publish Studio bounce' }, { status: 500 });
  }
});
