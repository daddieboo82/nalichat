import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const LEGACY_ARTIST_ROLES = new Set(['artist', 'producer', 'engineer', 'ar']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await base44.asServiceRole.entities.User.list();
    let migrated = 0;
    let initialized = 0;

    for (const user of users) {
      if (user.role === 'admin') {
        if (!user.artist_role) {
          await base44.asServiceRole.entities.User.update(user.id, { artist_role: 'artist' });
          initialized += 1;
        }
        continue;
      }

      if (LEGACY_ARTIST_ROLES.has(user.role)) {
        await base44.asServiceRole.entities.User.update(user.id, {
          role: 'user',
          artist_role: user.artist_role || user.role,
        });
        migrated += 1;
      } else if (!user.artist_role) {
        await base44.asServiceRole.entities.User.update(user.id, {
          role: 'user',
          artist_role: 'artist',
        });
        initialized += 1;
      }
    }

    return Response.json({ success: true, migrated, initialized });
  } catch (error) {
    return Response.json({ error: error?.message || 'Role migration failed' }, { status: 500 });
  }
});
