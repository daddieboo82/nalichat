import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// This feature was removed. The function is kept as a safe no-op so any
// lingering references (e.g. in the AI agent tool config) resolve cleanly
// instead of throwing a "function not found" error.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return Response.json({
      message: 'Generating fake/auto network profiles has been disabled.',
      generated: 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});