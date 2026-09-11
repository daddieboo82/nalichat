import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const MAX_SOURCE_TRACK_BYTES = 100 * 1024 * 1024;

function parseDate(value: unknown) {
  if (!value) return null;
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : null;
}

const TRUSTED_MEDIA_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
];

function cleanUploadedUrl(value: unknown) {
  if (!value) return '';
  const raw = String(value).trim();
  let parsed;
  try { parsed = new URL(raw); } catch { return ''; }
  if (parsed.protocol !== 'https:') return '';
  const hostname = parsed.hostname.toLowerCase();
  const trusted = TRUSTED_MEDIA_HOSTS.some(
    (host) => hostname === host || hostname.endsWith('.' + host),
  );
  return trusted ? parsed.toString() : '';
}

async function resolveStoredFileSize(url: string): Promise<number | null> {
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (head.ok) {
      const length = Number(head.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0) return length;
    }
  } catch {}

  try {
    const probe = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'manual',
    });
    if (probe.ok || probe.status === 206) {
      const range = probe.headers.get('content-range') || '';
      const match = range.match(/\/(\d+)$/);
      if (match) {
        const total = Number(match[1]);
        if (Number.isFinite(total) && total >= 0) return total;
      }
      const length = Number(probe.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0 && probe.status !== 206) return length;
    }
    try { await probe.body?.cancel(); } catch {}
  } catch {}

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const createRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'challenge_create',
      20,
    );
    if (!createRate.allowed) {
      return Response.json({ error: 'Challenge creation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const title = String(body?.title || '').trim().slice(0, 200);
    const description = String(body?.description || '').trim().slice(0, 3000);
    const sourceTrackUrl = cleanUploadedUrl(body?.source_track_url);
    const sourceTrackName = String(body?.source_track_name || '').trim().slice(0, 255);

    if (!title || !description || !sourceTrackUrl) {
      return Response.json({ error: 'Title, description, and a trusted uploaded source track are required' }, { status: 400 });
    }

    const sourceTrackSize = await resolveStoredFileSize(sourceTrackUrl);
    if (sourceTrackSize === null) {
      return Response.json({ error: 'Could not verify source track size' }, { status: 400 });
    }
    if (sourceTrackSize <= 0 || sourceTrackSize > MAX_SOURCE_TRACK_BYTES) {
      return Response.json({ error: 'Challenge source tracks must be 100MB or smaller' }, { status: 413 });
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
      host_artist_name: user.display_name || user.full_name || 'Artist',
      source_track_url: sourceTrackUrl,
      source_track_name: sourceTrackName || 'Challenge Source',
      genre: body?.genre ? String(body.genre).slice(0, 100) : undefined,
      bpm: Number.isFinite(bpm) && bpm > 0 && bpm <= 400 ? bpm : undefined,
      key: body?.key ? String(body.key).slice(0, 50) : undefined,
      rules: body?.rules ? String(body.rules).slice(0, 3000) : undefined,
      prize_description: body?.prize_description ? String(body.prize_description).slice(0, 2000) : undefined,
      cover_url: cleanUploadedUrl(body?.cover_url) || undefined,
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
