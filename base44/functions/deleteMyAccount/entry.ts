import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== 'DELETE') {
      return Response.json({ error: 'Confirmation required' }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.delete(user.id);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error?.message || 'Account deletion failed' },
      { status: 500 },
    );
  }
});
