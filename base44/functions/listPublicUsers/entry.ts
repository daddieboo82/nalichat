import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';

const MAX_DISCOVERY_USERS = 1000;
const MAX_DISCOVERY_ACHIEVEMENTS = 5000;

async function filterAllRows(
  entity: any,
  query: Record<string, unknown>,
  sort: string,
  pageSize = 200,
) {
  const rows: any[] = [];
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.filter(query, sort, pageSize, skip);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function publicUserProjection(
  u: any,
  achievementCount: number,
  presenceVisibleTo: Set<string>,
  mutualContactIds: Set<string>,
) {
  return {
    id: u.id,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    cover_url: u.cover_url,
    website: u.website,
    bio: u.bio,
    role: 'user',
    artist_role: u.artist_role || (
      ['artist', 'producer', 'engineer', 'ar'].includes(u.role) ? u.role : 'artist'
    ),
    location: u.location,
    genres: u.genres || u.genre || [],
    xp: Number(u.xp || 0),
    level: Number(u.level || Math.floor(Number(u.xp || 0) / 200) + 1),
    viral_concepts_generated: Number(u.viral_concepts_generated || 0),
    achievement_count: achievementCount,
    can_group_chat: mutualContactIds.has(u.id),
    is_online: presenceVisibleTo.has(u.id)
      ? Boolean(
          u.is_online
          && typeof u.last_seen === 'string'
          && Date.now() - Date.parse(u.last_seen) < 2 * 60 * 1000
        )
      : false,
  };
}

export default async function(req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const discoveryRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'public_user_discovery',
      120,
    );
    if (!discoveryRate.allowed) {
      return Response.json({ error: 'Discovery rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 8 * 1024);
    const requestedUserId = String(body?.userId || '').trim();
    const includeAchievementCounts = body?.includeAchievementCounts === true;
    const includePresence = body?.includePresence === true;
    if (requestedUserId && !isBase44EntityId(requestedUserId)) {
      return Response.json({ error: 'Invalid userId' }, { status: 400 });
    }

    if (requestedUserId) {
      const [target, targetAchievements, contacts, inboundContacts, conversations] = await Promise.all([
        base44.asServiceRole.entities.User.get(requestedUserId).catch(() => null),
        includeAchievementCounts
          ? base44.asServiceRole.entities.Achievement.filter(
              { user_id: requestedUserId },
              '-created_date',
              500,
            )
          : Promise.resolve([]),
        filterAllRows(
          base44.asServiceRole.entities.Contact,
          { user_id: user.id },
          '-created_date',
        ),
        filterAllRows(
          base44.asServiceRole.entities.Contact,
          { contact_user_id: user.id },
          '-created_date',
        ),
        includePresence
          ? filterAllRows(
              base44.asServiceRole.entities.Conversation,
              { participant_ids: user.id },
              '-last_message_at',
            )
          : Promise.resolve([]),
      ]);

      if (
        !target
        || !target.onboarding_completed
        || target.is_banned
        || !String(target.display_name || '').trim()
      ) {
        return Response.json({ error: 'Profile not found' }, { status: 404 });
      }

      const presenceVisibleTo = new Set<string>([user.id]);
      const inboundContactOwners = new Set(
        inboundContacts.map((contact: any) => contact.user_id).filter(Boolean),
      );
      const mutualContactIds = new Set<string>();
      for (const contact of contacts) {
        if (contact.contact_user_id && inboundContactOwners.has(contact.contact_user_id)) {
          mutualContactIds.add(contact.contact_user_id);
        }
      }
      for (const contact of contacts) {
        if (contact.contact_user_id && inboundContactOwners.has(contact.contact_user_id)) {
          presenceVisibleTo.add(contact.contact_user_id);
        }
      }
      for (const conversation of conversations) {
        for (const participantId of conversation.participant_ids || []) {
          presenceVisibleTo.add(participantId);
        }
      }

      return Response.json({
        success: true,
        viewerUserId: user.id,
        requestedUserId,
        contacts: contacts.map((contact: any) => ({
          id: contact.id,
          contact_user_id: contact.contact_user_id,
        })),
        users: [publicUserProjection(
          target,
          targetAchievements.length,
          presenceVisibleTo,
          mutualContactIds,
        )],
        truncated: {
          users: false,
          achievements: includeAchievementCounts && targetAchievements.length >= 500,
        },
      });
    }

    const [allUsers, achievements, contacts, inboundContacts, conversations] = await Promise.all([
      // Query the bounded service-role user directory, then apply moderation and
      // public-profile eligibility in the explicit projection below. This avoids
      // unreliable boolean custom-field filtering and keeps older legitimate
      // accounts discoverable in Messenger.
      base44.asServiceRole.entities.User.list(
        '-created_date',
        MAX_DISCOVERY_USERS,
      ),
      includeAchievementCounts
        ? base44.asServiceRole.entities.Achievement.list('-created_date', MAX_DISCOVERY_ACHIEVEMENTS)
        : Promise.resolve([]),
      filterAllRows(
        base44.asServiceRole.entities.Contact,
        { user_id: user.id },
        '-created_date',
      ),
      filterAllRows(
        base44.asServiceRole.entities.Contact,
        { contact_user_id: user.id },
        '-created_date',
      ),
      includePresence
        ? filterAllRows(
            base44.asServiceRole.entities.Conversation,
            { participant_ids: user.id },
            '-last_message_at',
          )
        : Promise.resolve([]),
    ]);

    // Messenger Active Now is a public discovery surface. When presence is
    // explicitly requested, eligible public profiles can expose a fresh online
    // heartbeat; publicUserProjection still enforces the last_seen freshness gate.
    const presenceVisibleTo = new Set<string>(
      includePresence ? allUsers.map((candidate: any) => candidate.id).filter(Boolean) : [user.id],
    );
    const inboundContactOwners = new Set(
      inboundContacts.map((contact: any) => contact.user_id).filter(Boolean),
    );
    const mutualContactIds = new Set<string>();
    for (const contact of contacts) {
      if (contact.contact_user_id && inboundContactOwners.has(contact.contact_user_id)) {
        mutualContactIds.add(contact.contact_user_id);
      }
    }
    for (const contact of contacts) {
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

    // Discovery itself stays bounded, but Messages relies on this endpoint for
    // names, avatars, and presence of people already in the caller's chats.
    // Always supplement conversation participants that fell outside the broad
    // discovery window so older DMs never degrade to an anonymous "User".
    const visibleUsers = [...allUsers];
    if (includePresence) {
      const loadedIds = new Set(visibleUsers.map((candidate: any) => candidate.id).filter(Boolean));
      const missingParticipantIds = [...presenceVisibleTo].filter(
        (participantId) => participantId !== user.id && !loadedIds.has(participantId),
      );
      const missingParticipants = await Promise.all(
        missingParticipantIds.map((participantId) =>
          base44.asServiceRole.entities.User.get(participantId).catch(() => null)
        ),
      );
      for (const participant of missingParticipants) {
        if (participant?.id && !loadedIds.has(participant.id)) {
          loadedIds.add(participant.id);
          visibleUsers.push(participant);
        }
      }
    }

    // Explicit public projection. Never return email, phone, birthdate, Stripe
    // identifiers, trial state, moderation state, or other account-only fields.
    const publicUsers = visibleUsers
      .filter((u) => !u.is_banned && String(u.display_name || '').trim())
      .map((u) => publicUserProjection(
        u,
        achievementCount[u.id] || 0,
        presenceVisibleTo,
        mutualContactIds,
      ));

    return Response.json({
      success: true,
      viewerUserId: user.id,
      requestedUserId: null,
      contacts: contacts.map((contact: any) => ({
        id: contact.id,
        contact_user_id: contact.contact_user_id,
      })),
      users: publicUsers,
      truncated: {
        users: allUsers.length >= MAX_DISCOVERY_USERS,
        achievements: includeAchievementCounts
          && achievements.length >= MAX_DISCOVERY_ACHIEVEMENTS,
      },
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('listPublicUsers error:', error);
    return Response.json({ error: 'Could not list public users' }, { status: 500 });
  }
}
