import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function parseDate(value: unknown) {
  if (!value) return null;
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function cleanUrl(value: unknown) {
  if (!value) return '';
  const raw = String(value).trim();
  let parsed;
  try { parsed = new URL(raw); } catch { return ''; }
  return parsed.protocol === 'https:' ? raw : '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const title = String(body?.title || '').trim().slice(0, 200);
    const description = String(body?.description || '').trim().slice(0, 3000);
    const sourceTrackUrl = cleanUrl(body?.source_track_url);
    const sourceTrackName = String(body?.source_track_name || '').trim().slice(0, 255);

    if (!title || !description || !sourceTrackUrl) {
      return Response.json({ error: 'Title, description, and source track are required' }, { status: 400 });
    }

    const start = parseDate(body?.start_date);
    const submissionEnd = parseDate(body?.submission_end_date);
    const votingEnd = parseDate(body?.voting_end_date);

    if (body?.start_date && start === null) {
      return Response.json({ error: 'Invalid start date' }, { status: 400 });
    }
    if (body?.submission_end_date && submissionEnd === null) {
      return Response.json({ error: 'Invalid submission end date' }, { status: 400 });
    }
    if (body?.voting_end_date && votingEnd === null) {
      return Response.json({ error: 'Invalid voting end date' }, { status: 400 });
    }

    if (start && submissionEnd && submissionEnd <= start) {
      return Response.json({ error: 'Submission deadline must be after the start date' }, { status: 400 });
    }
    if (submissionEnd && votingEnd && votingEnd <= submissionEnd) {
      return Response.json({ error: 'Voting deadline must be after the submission deadline' }, { status: 400 });
    }
    if (start && votingEnd && votingEnd <= start) {
      return Response.json({ error: 'Voting deadline must be after the start date' }, { status: 400 });
    }

    const now = Date.now();
    if (submissionEnd && submissionEnd <= now) {
      return Response.json({ error: 'Submission deadline must be in the future' }, { status: 400 });
    }
    if (votingEnd && votingEnd <= now) {
      return Response.json({ error: 'Voting deadline must be in the future' }, { status: 400 });
    }

    const status = start && start > now ? 'upcoming' : 'active';
    const bpm = Number(body?.bpm);

    const challenge = await base44.asServiceRole.entities.Challenge.create({
      title,
      description,
      host_artist_id: user.id,
      host_artist_name: user.display_name || user.full_name || user.email || 'Artist',
      source_track_url: sourceTrackUrl,
      source_track_name: sourceTrackName || 'Challenge Source',
      genre: body?.genre ? String(body.genre).slice(0, 100) : undefined,
      bpm: Number.isFinite(bpm) && bpm > 0 && bpm <= 400 ? bpm : undefined,
      key: body?.key ? String(body.key).slice(0, 50) : undefined,
      rules: body?.rules ? String(body.rules).slice(0, 3000) : undefined,
      prize_description: body?.prize_description ? String(body.prize_description).slice(0, 2000) : undefined,
      cover_url: cleanUrl(body?.cover_url) || undefined,
      status,
      start_date: start ? new Date(start).toISOString() : undefined,
      submission_end_date: submissionEnd ? new Date(submissionEnd).toISOString() : undefined,
      voting_end_date: votingEnd ? new Date(votingEnd).toISOString() : undefined,
    });

    return Response.json({ success: true, challenge });
  } catch (error) {
    console.error('createChallenge error:', error);
    return Response.json({ error: error?.message || 'Could not create challenge' }, { status: 500 });
  }
});
