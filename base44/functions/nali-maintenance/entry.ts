import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

// Nali's comprehensive app maintenance & repair function.
// Scans every entity for data issues and can either just report (diagnose)
// or automatically fix safe, non-destructive issues (repair).
//
// Payload: { mode: "diagnose" | "repair", scope?: string[] }
// - mode "diagnose": scan only, return a report of all issues found
// - mode "repair": fix all safe issues AND return a report of what was fixed
// - scope (optional): limit checks to specific entity names; omit for full scan
//
// Admin-only: repairing app data requires the admin role.
export default async function(req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    if (caller.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (caller.timeout_until && new Date(caller.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: caller.timeout_until }, { status: 403 });
    }

    const adminRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      caller.id,
      'admin_maintenance',
      12,
    );
    if (!adminRate.allowed) {
      return Response.json({ error: 'Admin operation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 16 * 1024);
    const mode = body.mode === 'repair' ? 'repair' : 'diagnose';
    const scope = Array.isArray(body.scope) && body.scope.length > 0 ? body.scope : null;
    const wants = (name) => !scope || scope.includes(name);

    const now = Date.now();
    const issues = [];       // { entity, id, field, issue, fixed }
    const fixed = [];        // { entity, id, change }
    const stats = {};

    // --- Load all entities in parallel (service role for full visibility) ---
    const s = base44.asServiceRole.entities;
    const loads = {};
    if (wants('ArtPost')) loads.artPosts = s.ArtPost.list('-created_date', 500);
    if (wants('Project')) loads.projects = s.Project.list('-created_date', 500);
    if (wants('Track')) loads.tracks = s.Track.list('-created_date', 500);
    if (wants('SharedFile')) loads.sharedFiles = s.SharedFile.list('-created_date', 500);
    if (wants('Subscription')) loads.subscriptions = s.Subscription.list('-created_date', 500);
    if (wants('Challenge')) loads.challenges = s.Challenge.list('-created_date', 500);
    if (wants('ChallengeSubmission')) loads.submissions = s.ChallengeSubmission.list('-created_date', 500);
    if (wants('ChallengeVote')) loads.votes = s.ChallengeVote.list('-created_date', 500);
    if (wants('Conversation')) loads.conversations = s.Conversation.list('-created_date', 500);
    if (wants('Message')) loads.messages = s.Message.list('-created_date', 500);
    if (wants('TrackVersion')) loads.trackVersions = s.TrackVersion.list('-created_date', 500);
    if (wants('Playlist')) {
      loads.playlists = s.Playlist.list('-created_date', 500);
      if (!loads.artPosts) loads.artPosts = s.ArtPost.list('-created_date', 500);
    }
    if (wants('UsageRateLimit')) loads.usageRateLimits = s.UsageRateLimit.list('-created_date', 1000);
    if (wants('User') || wants('Squad')) {
      loads.users = s.User.list('-created_date', 500);
      loads.squads = s.Squad.list('-created_date', 1000);
    }

    const data = {};
    const keys = Object.keys(loads);
    const values = await Promise.all(Object.values(loads));
    keys.forEach((k, i) => { data[k] = values[i]; });

    // Count records
    Object.entries(data).forEach(([k, v]) => { stats[k] = v.length; });

    // =====================================================
    // 1. PROJECT — missing/empty title → "Untitled Project"
    // =====================================================
    if (data.projects) {
      const untitled = data.projects.filter(p => !p.title || !p.title.trim());
      untitled.forEach(p => {
        issues.push({ entity: 'Project', id: p.id, field: 'title', issue: 'Missing or empty title' });
      });
      if (mode === 'repair' && untitled.length) {
        const updates = untitled.map(p => ({ id: p.id, title: 'Untitled Project' }));
        await s.Project.bulkUpdate(updates);
        updates.forEach(u => fixed.push({ entity: 'Project', id: u.id, change: 'title → "Untitled Project"' }));
      }
    }

    // =====================================================
    // 2. SUBSCRIPTION — stale trial → ended
    // =====================================================
    if (data.subscriptions) {
      const staleTrials = data.subscriptions.filter(sub =>
        (sub.status === 'trial' || sub.status === 'trialing')
          && sub.trial_end_date
          && new Date(sub.trial_end_date).getTime() < now
      );
      staleTrials.forEach(sub => {
        issues.push({ entity: 'Subscription', id: sub.id, field: 'status', issue: `Trial ended but status still "${sub.status}"` });
      });
      if (mode === 'repair' && staleTrials.length) {
        const updates = staleTrials.map(sub => ({ id: sub.id, status: 'ended' }));
        await s.Subscription.bulkUpdate(updates);
        updates.forEach(u => fixed.push({ entity: 'Subscription', id: u.id, change: 'status → "ended"' }));
      }
    }

    // =====================================================
    // 3. CHALLENGE — status out of sync with dates
    // =====================================================
    if (data.challenges) {
      const statusFixes = [];
      data.challenges.forEach(c => {
        let target = c.status;
        const subEnd = c.submission_end_date ? new Date(c.submission_end_date).getTime() : null;
        const voteEnd = c.voting_end_date ? new Date(c.voting_end_date).getTime() : null;
        const start = c.start_date ? new Date(c.start_date).getTime() : null;

        if (c.status === 'completed') return; // terminal, leave alone

        if (voteEnd && voteEnd < now && c.status !== 'completed') {
          target = 'completed';
        } else if (subEnd && subEnd < now && c.status === 'active') {
          target = 'voting';
        } else if (start && start < now && c.status === 'upcoming') {
          target = 'active';
        }

        if (target !== c.status) {
          issues.push({ entity: 'Challenge', id: c.id, field: 'status', issue: `Status "${c.status}" doesn't match dates → should be "${target}"` });
          if (mode === 'repair') statusFixes.push({ id: c.id, status: target });
        }
      });
      if (mode === 'repair' && statusFixes.length) {
        await s.Challenge.bulkUpdate(statusFixes);
        statusFixes.forEach(u => fixed.push({ entity: 'Challenge', id: u.id, change: `status → "${u.status}"` }));
      }
    }

    // =====================================================
    // 4. ARTPOST — likes count out of sync with liked_by
    // =====================================================
    if (data.artPosts) {
      const likeMismatches = [];
      data.artPosts.forEach(post => {
        const likedBy = Array.isArray(post.liked_by) ? post.liked_by : [];
        const actualLikes = likedBy.length;
        if (post.likes !== actualLikes) {
          issues.push({ entity: 'ArtPost', id: post.id, field: 'likes', issue: `likes (${post.likes}) != liked_by length (${actualLikes})` });
          if (mode === 'repair') likeMismatches.push({ id: post.id, likes: actualLikes });
        }
      });
      if (mode === 'repair' && likeMismatches.length) {
        await s.ArtPost.bulkUpdate(likeMismatches);
        likeMismatches.forEach(u => fixed.push({ entity: 'ArtPost', id: u.id, change: `likes → ${u.likes}` }));
      }

      // Report-only: posts with no media at all
      const noMedia = data.artPosts.filter(p => !p.file_url && !p.image_url);
      noMedia.forEach(p => {
        issues.push({ entity: 'ArtPost', id: p.id, field: 'file_url', issue: 'No audio file or image attached (manual review needed)' });
      });
    }

    // =====================================================
    // 5. CHALLENGE SUBMISSION — vote_count out of sync
    // =====================================================
    if (data.submissions && data.votes) {
      const voteMap = {};
      data.votes.forEach(v => {
        if (!voteMap[v.submission_id]) voteMap[v.submission_id] = 0;
        voteMap[v.submission_id]++;
      });
      const voteFixes = [];
      data.submissions.forEach(sub => {
        const actual = voteMap[sub.id] || 0;
        if (sub.vote_count !== actual) {
          issues.push({ entity: 'ChallengeSubmission', id: sub.id, field: 'vote_count', issue: `vote_count (${sub.vote_count}) != actual votes (${actual})` });
          if (mode === 'repair') voteFixes.push({ id: sub.id, vote_count: actual });
        }
      });
      if (mode === 'repair' && voteFixes.length) {
        await s.ChallengeSubmission.bulkUpdate(voteFixes);
        voteFixes.forEach(u => fixed.push({ entity: 'ChallengeSubmission', id: u.id, change: `vote_count → ${u.vote_count}` }));
      }
    }

    // =====================================================
    // 6. CONVERSATION — stale last_message_text / last_message_at
    // =====================================================
    if (data.conversations && data.messages) {
      const msgByConv = {};
      data.messages.forEach(m => {
        if (!msgByConv[m.conversation_id]) msgByConv[m.conversation_id] = [];
        msgByConv[m.conversation_id].push(m);
      });
      const convFixes = [];
      data.conversations.forEach(conv => {
        const msgs = (msgByConv[conv.id] || []).sort((a, b) =>
          new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
        );
        if (msgs.length === 0) return;
        const latest = msgs[0];
        const latestAt = latest.created_date;
        const convAt = conv.last_message_at;
        const atStale = !convAt || new Date(convAt).getTime() !== new Date(latestAt).getTime();
        const textStale = (conv.last_message_text || '') !== (latest.text || '');

        if (atStale || textStale) {
          issues.push({ entity: 'Conversation', id: conv.id, field: 'last_message_at', issue: 'last_message_at/text is stale' });
          if (mode === 'repair') {
            convFixes.push({ id: conv.id, last_message_at: latestAt, last_message_text: latest.text || '' });
          }
        }
      });
      if (mode === 'repair' && convFixes.length) {
        await s.Conversation.bulkUpdate(convFixes);
        convFixes.forEach(u => fixed.push({ entity: 'Conversation', id: u.id, change: 'last_message_at/text refreshed' }));
      }
    }

    // =====================================================
    // 7. MESSAGE — missing participant_ids → backfill from conversation
    // =====================================================
    if (data.messages && data.conversations) {
      const convParticipants = {};
      data.conversations.forEach(c => {
        convParticipants[c.id] = Array.isArray(c.participant_ids) ? c.participant_ids : [];
      });
      const msgFixes = [];
      data.messages.forEach(m => {
        if (!Array.isArray(m.participant_ids) || m.participant_ids.length === 0) {
          const participants = convParticipants[m.conversation_id] || [];
          if (participants.length > 0) {
            issues.push({ entity: 'Message', id: m.id, field: 'participant_ids', issue: 'Missing participant_ids (needed for read access scoping)' });
            if (mode === 'repair') msgFixes.push({ id: m.id, participant_ids: participants });
          }
        }
      });
      if (mode === 'repair' && msgFixes.length) {
        // bulkUpdate in batches of 100
        for (let i = 0; i < msgFixes.length; i += 100) {
          await s.Message.bulkUpdate(msgFixes.slice(i, i + 100));
        }
        msgFixes.forEach(u => fixed.push({ entity: 'Message', id: u.id, change: 'participant_ids backfilled from conversation' }));
      }
    }

    // =====================================================
    // 8. TRACK — missing file_url (report only, can't auto-fix)
    // =====================================================
    if (data.tracks) {
      const noUrl = data.tracks.filter(t => !t.file_url);
      noUrl.forEach(t => {
        issues.push({ entity: 'Track', id: t.id, field: 'file_url', issue: 'Missing audio file_url (manual review needed)' });
      });
    }

    // =====================================================
    // 9. SHAREDFILE — missing file_url (report only)
    // =====================================================
    if (data.sharedFiles) {
      const noUrl = data.sharedFiles.filter(f => !f.file_url);
      noUrl.forEach(f => {
        issues.push({ entity: 'SharedFile', id: f.id, field: 'file_url', issue: 'Missing file_url (manual review needed)' });
      });
    }

    // =====================================================
    // 10. TRACKVERSION — orphaned (parent track no longer exists)
    // =====================================================
    if (data.trackVersions && data.tracks) {
      const trackIds = new Set(data.tracks.map(t => t.id));
      const orphaned = data.trackVersions.filter(v => !trackIds.has(v.track_id));
      orphaned.forEach(v => {
        issues.push({ entity: 'TrackVersion', id: v.id, field: 'track_id', issue: 'Orphaned version — parent track no longer exists (manual review needed)' });
      });
    }

    // =====================================================
    // 11. USER — incomplete onboarding (report only)
    // =====================================================
    if (data.users) {
      const noOnboarding = data.users.filter(u => !u.onboarding_completed);
      noOnboarding.forEach(u => {
        issues.push({ entity: 'User', id: u.id, field: 'onboarding_completed', issue: 'User has not completed onboarding' });
      });
    }

    // =====================================================
    // 12. USER — invalid avatar_url (not an image URL)
    // =====================================================
    if (data.users) {
      const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|#|$)/i;
      const CDN_PATTERNS = ['base44', 'googleapis', 'amazonaws', 'cloudinary', 'imgur', 'githubusercontent'];
      const isValidAvatar = (url) => {
        if (!url) return true;
        if (typeof url !== 'string') return false;
        if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
        if (IMAGE_EXT.test(url)) return true;
        if (CDN_PATTERNS.some(p => url.includes(p))) return true;
        return false;
      };
      const badAvatars = data.users.filter(u => !isValidAvatar(u.avatar_url));
      const avatarFixes = [];
      badAvatars.forEach(u => {
        issues.push({ entity: 'User', id: u.id, field: 'avatar_url', issue: `Invalid avatar_url (not an image): "${u.avatar_url}"` });
        if (mode === 'repair') avatarFixes.push({ id: u.id, avatar_url: '' });
      });
      if (mode === 'repair' && avatarFixes.length) {
        await s.User.bulkUpdate(avatarFixes);
        avatarFixes.forEach(u => fixed.push({ entity: 'User', id: u.id, change: 'avatar_url cleared (was not an image URL)' }));
      }
    }


    // =====================================================
    // 13. PLAYLIST — remove references to deleted ArtPosts
    // =====================================================
    if (data.playlists && data.artPosts) {
      const validPostIds = new Set(data.artPosts.map((post) => post.id));
      const playlistFixes = [];
      data.playlists.forEach((playlist) => {
        const currentIds = Array.isArray(playlist.track_ids) ? playlist.track_ids : [];
        const validIds = currentIds.filter((id) => validPostIds.has(id));
        if (validIds.length !== currentIds.length) {
          issues.push({
            entity: 'Playlist',
            id: playlist.id,
            field: 'track_ids',
            issue: `${currentIds.length - validIds.length} deleted track reference(s)`,
          });
          if (mode === 'repair') playlistFixes.push({ id: playlist.id, track_ids: validIds });
        }
      });
      if (mode === 'repair' && playlistFixes.length) {
        await s.Playlist.bulkUpdate(playlistFixes);
        playlistFixes.forEach((u) => fixed.push({
          entity: 'Playlist',
          id: u.id,
          change: 'removed deleted track references',
        }));
      }
    }

    // =====================================================
    // 14. USAGE RATE LIMIT — delete expired ledger rows
    // =====================================================
    if (data.usageRateLimits) {
      const expired = data.usageRateLimits.filter((row) =>
        row.expires_at && new Date(row.expires_at).getTime() < now
      );
      expired.forEach((row) => {
        issues.push({
          entity: 'UsageRateLimit',
          id: row.id,
          field: 'expires_at',
          issue: 'Expired rate-limit ledger row',
        });
      });
      if (mode === 'repair') {
        for (const row of expired) {
          await s.UsageRateLimit.delete(row.id);
          fixed.push({
            entity: 'UsageRateLimit',
            id: row.id,
            change: 'expired row deleted',
          });
        }
      }
    }

    // =====================================================
    // 15. USER/SQUAD — repair atomic squad membership claims
    // =====================================================
    if (data.users && data.squads) {
      const memberships = new Map();
      for (const squad of data.squads) {
        if (squad.status === 'ended') continue;
        for (const memberId of [squad.member_a_id, squad.member_b_id].filter(Boolean)) {
          if (!memberships.has(memberId)) memberships.set(memberId, []);
          memberships.get(memberId).push(squad.id);
        }
      }

      for (const user of data.users) {
        const activeIds = memberships.get(user.id) || [];
        if (activeIds.length > 1) {
          issues.push({
            entity: 'User',
            id: user.id,
            field: 'squad_membership_id',
            issue: `User belongs to ${activeIds.length} non-ended squads; manual review required`,
          });
          continue;
        }

        const expected = activeIds[0] || null;
        const current = user.squad_membership_id || null;
        if (current !== expected) {
          issues.push({
            entity: 'User',
            id: user.id,
            field: 'squad_membership_id',
            issue: `Squad membership claim "${current || ''}" should be "${expected || ''}"`,
          });
          if (mode === 'repair') {
            await s.User.update(user.id, { squad_membership_id: expected });
            fixed.push({
              entity: 'User',
              id: user.id,
              change: `squad_membership_id → ${expected || 'null'}`,
            });
          }
        }
      }
    }

    // --- Build summary ---
    const byEntity = {};
    issues.forEach(i => {
      if (!byEntity[i.entity]) byEntity[i.entity] = 0;
      byEntity[i.entity]++;
    });

    const result = {
      mode,
      scanned: stats,
      totalIssues: issues.length,
      issuesByEntity: byEntity,
      totalFixed: mode === 'repair' ? fixed.length : 0,
      issues: issues.slice(0, 100),    // cap for response size
      fixed: mode === 'repair' ? fixed.slice(0, 100) : [],
      needsAttention: issues.length > 0,
      truncated: {
        users: Array.isArray(data.users) && data.users.length >= 500,
        squads: Array.isArray(data.squads) && data.squads.length >= 1000,
      },
    };

    console.log(`Nali maintenance (${mode}): ${issues.length} issues found, ${fixed.length} fixed.`);
    return Response.json(result);
  } catch (error) {
    console.error('nali-maintenance error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}