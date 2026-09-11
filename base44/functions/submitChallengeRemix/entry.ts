import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const MAX_REMIX_BYTES = 100 * 1024 * 1024;
const ALLOWED_SOURCE_TYPES = new Set(['nalichat_studio', 'external_upload', 'link_import']);
const ALLOWED_FORMATS = new Set(['mp3', 'wav']);
const TRUSTED_UPLOAD_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
];

function safeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function trustedUploadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.internal') || host.endsWith('.local')) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return TRUSTED_UPLOAD_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed));
  } catch {
    return false;
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: 'You must be logged in to submit.' }, { status: 401 });
    }

    const body = await req.json();
    const challengeId = safeText(body?.challenge_id, 128);
    const remixName = safeText(body?.remix_name, 160);
    const description = safeText(body?.description, 2000);
    const sourceType = safeText(body?.source_type, 32);
    const sourceId = safeText(body?.source_id, 128);
    const requestedUrl = safeText(body?.remix_file_url, 4096);
    const externalUrl = safeText(body?.external_url, 4096);
    const fileFormat = safeText(body?.file_format, 16).toLowerCase();
    const deviceType = ['desktop', 'mobile', 'tablet'].includes(body?.device_type)
      ? body.device_type
      : 'desktop';

    if (!challengeId || !remixName || !ALLOWED_SOURCE_TYPES.has(sourceType)) {
      return Response.json({ error: 'Invalid challenge submission.' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const challenge = await entities.Challenge.get(challengeId);
    if (!challenge) return Response.json({ error: 'Challenge not found.' }, { status: 404 });
    if (challenge.status !== 'active') {
      return Response.json({ error: 'Submissions are not open for this challenge.' }, { status: 409 });
    }

    const submissionEnd = challenge.submission_end_date
      ? Date.parse(challenge.submission_end_date)
      : Number.NaN;
    if (Number.isFinite(submissionEnd) && Date.now() > submissionEnd) {
      return Response.json({ error: 'The submission deadline has passed.' }, { status: 409 });
    }

    let remixFileUrl = requestedUrl;
    let storedExternalUrl = externalUrl || null;
    let storedFormat = fileFormat || null;

    if (sourceType === 'nalichat_studio') {
      if (!sourceId) return Response.json({ error: 'Select one of your tracks.' }, { status: 400 });
      const track = await entities.ArtPost.get(sourceId);
      if (!track || track.creator_id !== user.id || !track.file_url) {
        return Response.json({ error: 'Selected track is not available to submit.' }, { status: 403 });
      }
      remixFileUrl = track.file_url;
      storedExternalUrl = null;
      storedFormat = null;
    } else if (sourceType === 'external_upload') {
      if (!remixFileUrl || !trustedUploadUrl(remixFileUrl) || !ALLOWED_FORMATS.has(fileFormat)) {
        return Response.json({ error: 'Uploaded remix must be an MP3 or WAV file.' }, { status: 400 });
      }

      try {
        const head = await fetch(remixFileUrl, { method: 'HEAD' });
        if (!head.ok) {
          return Response.json({ error: 'Uploaded remix could not be verified.' }, { status: 400 });
        }
        const length = Number(head.headers.get('content-length'));
        if (Number.isFinite(length) && length > MAX_REMIX_BYTES) {
          return Response.json({ error: 'Remix file must be 100MB or smaller.' }, { status: 413 });
        }
      } catch {
        return Response.json({ error: 'Uploaded remix could not be verified.' }, { status: 400 });
      }
      storedExternalUrl = null;
    } else {
      if (!remixFileUrl || !validHttpsUrl(remixFileUrl)) {
        return Response.json({ error: 'A valid HTTPS remix link is required.' }, { status: 400 });
      }
      storedExternalUrl = remixFileUrl;
      storedFormat = null;
    }

    const submission = await entities.ChallengeSubmission.create({
      challenge_id: challengeId,
      producer_id: user.id,
      producer_name: user.display_name || user.full_name || user.email || 'Producer',
      producer_avatar: user.avatar_url || null,
      remix_file_url: remixFileUrl,
      remix_name: remixName,
      description,
      source_type: sourceType,
      ...(storedExternalUrl ? { external_url: storedExternalUrl } : {}),
      ...(storedFormat ? { file_format: storedFormat } : {}),
      device_type: deviceType,
      status: 'approved',
      vote_count: 0,
    });

    return Response.json({ success: true, submission });
  } catch (error) {
    console.error('submitChallengeRemix error:', error);
    return Response.json({ error: error?.message || 'Submission failed' }, { status: 500 });
  }
}
