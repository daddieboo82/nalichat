import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const LEGACY_ARTIST_ROLES = new Set(['artist', 'producer', 'engineer', 'ar']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (caller.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (caller.timeout_until && new Date(caller.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: caller.timeout_until }, { status: 403 });
    }

    const migrationRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      caller.id,
      'admin_role_migration',
      2,
    );
    if (!migrationRate.allowed) {
      return Response.json({ error: 'Admin operation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const PAGE_SIZE = 200;
    let migrated = 0;
    let initialized = 0;
    let scanned = 0;

    for (let skip = 0; ; skip += PAGE_SIZE) {
      const users = await base44.asServiceRole.entities.User.filter(
        {},
        '-created_date',
        PAGE_SIZE,
        skip,
      );
      scanned += users.length;

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

      if (users.length < PAGE_SIZE) break;
    }

    return Response.json({ success: true, scanned, migrated, initialized });
  } catch (error) {
    return Response.json({ error: error?.message || 'Role migration failed' }, { status: 500 });
  }
});
