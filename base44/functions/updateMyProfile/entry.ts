import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const VALID_ARTIST_ROLES = new Set(['artist', 'producer', 'engineer', 'ar']);
const VALID_NALI_LEVELS = new Set(['proactive', 'minimal', 'off']);

function cleanBirthdate(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(raw + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return parsed.getTime() <= today ? raw : null;
}

function cleanUploadedImage(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    const hostname = parsed.hostname.toLowerCase();
    const trustedHosts = [
      'storage.googleapis.com',
      'base44-user-files.s3.amazonaws.com',
      'base44-user-files.s3.us-east-1.amazonaws.com',
      'files.base44.com',
      'cdn.base44.com',
    ];
    return trustedHosts.some((host) => hostname === host || hostname.endsWith('.' + host))
      ? parsed.toString()
      : '';
  } catch {
    return '';
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'profile_update',
      120,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const patch: Record<string, unknown> = {};

    if (body?.display_name !== undefined) patch.display_name = String(body.display_name || '').trim().slice(0, 120);
    if (body?.bio !== undefined) patch.bio = String(body.bio || '').trim().slice(0, 2000);
    if (body?.location !== undefined) patch.location = String(body.location || '').trim().slice(0, 200);
    if (body?.website !== undefined) {
      const raw = String(body.website || '').trim();
      if (!raw) {
        patch.website = '';
      } else {
        let parsed;
        try { parsed = new URL(raw); } catch {
          return Response.json({ error: 'Website must be a valid URL' }, { status: 400 });
        }
        if (!['https:', 'http:'].includes(parsed.protocol)) {
          return Response.json({ error: 'Website must use HTTP or HTTPS' }, { status: 400 });
        }
        patch.website = parsed.toString().slice(0, 500);
      }
    }
    if (body?.birthdate !== undefined) {
      const birthdate = cleanBirthdate(body.birthdate);
      if (birthdate === null) {
        return Response.json({ error: 'Invalid birthdate' }, { status: 400 });
      }
      patch.birthdate = birthdate || null;
    }
    if (body?.genres !== undefined) {
      patch.genres = Array.isArray(body.genres)
        ? Array.from(new Set(body.genres.map((g: unknown) => String(g || '').trim()).filter(Boolean))).slice(0, 20)
        : [];
    }
    if (body?.artist_role !== undefined) {
      const role = String(body.artist_role || '');
      if (!VALID_ARTIST_ROLES.has(role)) return Response.json({ error: 'Invalid artist role' }, { status: 400 });
      patch.artist_role = role;
    }
    if (body?.nali_presence_level !== undefined) {
      const level = String(body.nali_presence_level || '');
      if (!VALID_NALI_LEVELS.has(level)) return Response.json({ error: 'Invalid Nali presence level' }, { status: 400 });
      patch.nali_presence_level = level;
    }
    if (body?.welcome_tour_completed !== undefined) patch.welcome_tour_completed = Boolean(body.welcome_tour_completed);
    if (body?.avatar_url !== undefined) {
      const avatar = body.avatar_url ? cleanUploadedImage(body.avatar_url) : '';
      if (body.avatar_url && !avatar) {
        return Response.json({ error: 'Avatar must come from trusted upload storage' }, { status: 400 });
      }
      patch.avatar_url = avatar;
    }
    if (body?.cover_url !== undefined) {
      const cover = body.cover_url ? cleanUploadedImage(body.cover_url) : '';
      if (body.cover_url && !cover) {
        return Response.json({ error: 'Profile cover must come from trusted upload storage' }, { status: 400 });
      }
      patch.cover_url = cover;
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No supported profile fields supplied' }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.update(user.id, patch);
    return Response.json({ success: true });
  } catch (error) {
    console.error('updateMyProfile error:', error);
    return Response.json({ error: error?.message || 'Profile update failed' }, { status: 500 });
  }
});
