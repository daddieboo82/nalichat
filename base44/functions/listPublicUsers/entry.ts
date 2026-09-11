import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [allUsers, achievements] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Achievement.list(),
    ]);

    const achievementCount = {};
    for (const achievement of achievements) {
      achievementCount[achievement.user_id] = (achievementCount[achievement.user_id] || 0) + 1;
    }

    // Explicit public projection. Never return email, phone, birthdate, Stripe
    // identifiers, trial state, moderation state, or other account-only fields.
    const publicUsers = allUsers
      .filter((u) => u.onboarding_completed && !u.is_banned && String(u.display_name || '').trim())
      .map((u) => ({
      id: u.id,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      cover_url: u.cover_url,
      website: u.website,
      bio: u.bio,
      role: u.role === 'admin' ? 'admin' : 'user',
      artist_role: u.artist_role || (
        ['artist', 'producer', 'engineer', 'ar'].includes(u.role) ? u.role : 'artist'
      ),
      location: u.location,
      genres: u.genres || u.genre || [],
      xp: Number(u.xp || 0),
      level: Number(u.level || Math.floor(Number(u.xp || 0) / 200) + 1),
      viral_concepts_generated: Number(u.viral_concepts_generated || 0),
      achievement_count: achievementCount[u.id] || 0,
      is_online: Boolean(u.is_online),
      created_date: u.created_date,
    }));

    return Response.json({ users: publicUsers });
  } catch (error) {
    console.error('listPublicUsers error:', error);
    return Response.json({ error: error?.message || 'Could not list public users' }, { status: 500 });
  }
}
