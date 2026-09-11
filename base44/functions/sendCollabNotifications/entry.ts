import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Legacy one-off outreach function retained for compatibility only.
// Hard-coded recipient lists are intentionally disabled to prevent accidental
// re-sends to historical accounts. Use current, auditable notification flows.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    return Response.json({
      success: true,
      sent: 0,
      legacy_noop: true,
      message: 'Legacy collaboration broadcast is disabled.',
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not process legacy notification request' }, { status: 500 });
  }
}
