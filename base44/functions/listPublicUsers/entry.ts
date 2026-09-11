import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const discoveryRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'public_user_discovery',
      120,
    );
    if (!discoveryRate.allowed) {
      return Response.json({ error: 'Discovery rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const [allUsers, achievements, contacts, inboundContacts, conversations] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Achievement.list(),
      base44.asServiceRole.entities.Contact.filter({ user_id: user.id }),
      base44.asServiceRole.entities.Contact.filter({ contact_user_id: user.id }),
      base44.asServiceRole.entities.Conversation.filter({ participant_ids: user.id }),
    ]);

    const presenceVisibleTo = new Set<string>([user.id]);
    const inboundContactOwners = new Set(
      inboundContacts.map((contact: any) => contact.user_id).filter(Boolean),
    );
    for (const contact of contacts) {
      // Contact lists are unilateral. Reveal presence only when the relationship
      // is mutual, otherwise simply adding a public profile would become an
      // online-status tracking primitive.
      if (contact.contact_user_id && inboundContactOwners.has(contact.contact_user_id)) {
        presenceVisibleTo.add(contact.contact_user_id);
      }
    }
    for (const conversation of conversations) {
      for (const participantId of conversation.participant_ids || []) {
        presenceVisibleTo.add(participantId);
      }
    }

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
      // Never expose authorization privilege through public discovery.
      role: 'user',
      artist_role: u.artist_role || (
        ['artist', 'producer', 'engineer', 'ar'].includes(u.role) ? u.role : 'artist'
      ),
      location: u.location,
      genres: u.genres || u.genre || [],
      xp: Number(u.xp || 0),
      level: Number(u.level || Math.floor(Number(u.xp || 0) / 200) + 1),
      viral_concepts_generated: Number(u.viral_concepts_generated || 0),
      achievement_count: achievementCount[u.id] || 0,
      is_online: presenceVisibleTo.has(u.id)
        ? Boolean(
            u.is_online
            && typeof u.last_seen === 'string'
            && Date.now() - Date.parse(u.last_seen) < 2 * 60 * 1000
          )
        : false,
    }));

    return Response.json({ users: publicUsers });
  } catch (error) {
    console.error('listPublicUsers error:', error);
    return Response.json({ error: error?.message || 'Could not list public users' }, { status: 500 });
  }
}
