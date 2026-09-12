import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import {
  acquireChallengeLifecycleLock,
  releaseChallengeLifecycleLock,
} from '../../shared/challengeLifecycleLock.ts';

const SOURCE_TYPES = new Set(['nalichat_studio', 'external_upload', 'link_import']);
const DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet']);
const FILE_FORMATS = new Set(['wav', 'mp3']);
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const TRUSTED_MEDIA_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
];

function isSafeExternalMediaUrl(parsed: URL) {
  if (parsed.protocol !== 'https:') return false;
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost'
    || hostname === 'metadata.google.internal'
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(hostname)
  ) return false;
  return true;
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

function challengeSubmissionStateError(challenge: any, now = Date.now()) {
  const startsAt = challenge?.start_date ? new Date(challenge.start_date).getTime() : null;
  const endsAt = challenge?.submission_end_date ? new Date(challenge.submission_end_date).getTime() : null;

  if (challenge?.status !== 'active') {
    return 'This challenge is not accepting submissions';
  }
  if (startsAt && Number.isFinite(startsAt) && startsAt > now) {
    return 'Challenge submissions have not opened yet';
  }
  if (endsAt && Number.isFinite(endsAt) && endsAt < now) {
    return 'Challenge submission deadline has passed';
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const submissionRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'challenge_submission',
      20,
    );
    if (!submissionRate.allowed) {
      return Response.json({ error: 'Challenge submission rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 64 * 1024);
    if (
      typeof body?.challenge_id !== 'string'
      || typeof body?.remix_name !== 'string'
      || typeof body?.source_type !== 'string'
    ) {
      return Response.json({ error: 'Invalid challenge submission' }, { status: 400 });
    }
    const challengeId = body.challenge_id.trim();
    const remixName = body.remix_name.trim();
    const sourceType = body.source_type;

    if (
      !challengeId
      || challengeId.length > 200
      || !remixName
      || remixName.length > 200
      || !SOURCE_TYPES.has(sourceType)
    ) {
      return Response.json({ error: 'Invalid challenge submission' }, { status: 400 });
    }
    if (body?.description != null && typeof body.description !== 'string') {
      return Response.json({ error: 'Description must be a string' }, { status: 400 });
    }
    if (typeof body?.description === 'string' && body.description.length > 2000) {
      return Response.json({ error: 'Description must be 2000 characters or fewer' }, { status: 413 });
    }

    const entities = base44.asServiceRole.entities;
    const challengePreview = await entities.Challenge.get(challengeId).catch(() => null);
    if (!challengePreview) {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }
    const previewStateError = challengeSubmissionStateError(challengePreview);
    if (previewStateError) {
      return Response.json({ error: previewStateError }, { status: 409 });
    }

    let remixFileUrl = '';
    let externalUrl = '';
    let fileFormat = '';

    if (sourceType === 'nalichat_studio') {
      const sourcePostId = String(body?.source_post_id || '');
      if (!sourcePostId) return Response.json({ error: 'Select one of your published tracks' }, { status: 400 });
      const post = await entities.ArtPost.get(sourcePostId);
      if (!post || post.creator_id !== user.id || !post.file_url) {
        return Response.json({ error: 'Selected track is not available to submit' }, { status: 403 });
      }
      let storedPostUrl;
      try { storedPostUrl = new URL(String(post.file_url)); } catch {
        return Response.json({ error: 'Selected track media URL is invalid' }, { status: 400 });
      }
      const storedPostHost = storedPostUrl.hostname.toLowerCase();
      const trustedStoredPost = storedPostUrl.protocol === 'https:' && TRUSTED_MEDIA_HOSTS.some(
        (host) => storedPostHost === host || storedPostHost.endsWith('.' + host),
      );
      if (!trustedStoredPost) {
        return Response.json({ error: 'Selected track media is not on trusted storage' }, { status: 400 });
      }
      remixFileUrl = storedPostUrl.toString();
      const storedSize = await resolveStoredFileSize(remixFileUrl);
      if (storedSize === null) {
        return Response.json({ error: 'Could not verify selected track size' }, { status: 400 });
      }
      if (storedSize <= 0 || storedSize > MAX_UPLOAD_BYTES) {
        return Response.json({ error: 'Selected track must be 100MB or smaller' }, { status: 413 });
      }
    } else if (sourceType === 'external_upload') {
      fileFormat = String(body?.file_format || '').toLowerCase();
      if (!FILE_FORMATS.has(fileFormat)) {
        return Response.json({ error: 'Only MP3 and WAV submissions are supported' }, { status: 400 });
      }
      remixFileUrl = String(body?.remix_file_url || '').trim();
      let uploadedUrl;
      try { uploadedUrl = new URL(remixFileUrl); } catch {
        return Response.json({ error: 'Uploaded remix URL is invalid' }, { status: 400 });
      }
      const hostname = uploadedUrl.hostname.toLowerCase();
      const trusted = uploadedUrl.protocol === 'https:' && TRUSTED_MEDIA_HOSTS.some(
        (host) => hostname === host || hostname.endsWith('.' + host),
      );
      if (!trusted) {
        return Response.json({ error: 'Uploaded remix must come from trusted upload storage' }, { status: 400 });
      }
      remixFileUrl = uploadedUrl.toString();

      const storedSize = await resolveStoredFileSize(remixFileUrl);
      if (storedSize === null) {
        return Response.json({ error: 'Could not verify uploaded remix size' }, { status: 400 });
      }
      if (storedSize <= 0 || storedSize > MAX_UPLOAD_BYTES) {
        return Response.json({ error: 'Uploaded remix must be 100MB or smaller' }, { status: 413 });
      }
    } else {
      externalUrl = String(body?.external_url || '').trim();
      let parsed;
      try { parsed = new URL(externalUrl); } catch {
        return Response.json({ error: 'Invalid remix link' }, { status: 400 });
      }
      if (!isSafeExternalMediaUrl(parsed)) {
        return Response.json({ error: 'Remix links must use a public HTTPS host' }, { status: 400 });
      }
      remixFileUrl = parsed.toString();
    }

    const deviceType = DEVICE_TYPES.has(body?.device_type) ? body.device_type : 'desktop';

    // Media validation above can perform network I/O. Only hold the challenge
    // lifecycle lock for the final state re-check and submission write.
    const challengeLockId = await acquireChallengeLifecycleLock(entities, challengeId);
    if (!challengeLockId) {
      return Response.json(
        { error: 'Challenge is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const challenge = await entities.Challenge.get(challengeId);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });
    const lockedStateError = challengeSubmissionStateError(challenge);
    if (lockedStateError) {
      return Response.json({ error: lockedStateError }, { status: 409 });
    }

    const submission = await entities.ChallengeSubmission.create({
      challenge_id: challenge.id,
      producer_id: user.id,
      producer_name: user.display_name || user.full_name || 'User',
      producer_avatar: user.avatar_url || null,
      remix_file_url: remixFileUrl,
      remix_name: remixName,
      description: typeof body?.description === 'string' ? body.description : '',
      source_type: sourceType,
      external_url: externalUrl || undefined,
      file_format: fileFormat || undefined,
      device_type: deviceType,
      status: 'approved',
      vote_count: 0,
    });

    return Response.json({ success: true, submission });
    } finally {
      await releaseChallengeLifecycleLock(entities, challengeLockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('submitChallengeRemix error:', error);
    return Response.json({ error: 'Could not submit remix' }, { status: 500 });
  }
});
