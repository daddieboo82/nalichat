import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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

    const body = await req.json();
    const challengeId = String(body?.challenge_id || '');
    const remixName = String(body?.remix_name || '').trim().slice(0, 200);
    const sourceType = String(body?.source_type || '');

    if (!challengeId || !remixName || !SOURCE_TYPES.has(sourceType)) {
      return Response.json({ error: 'Invalid challenge submission' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const challenge = await entities.Challenge.get(challengeId);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });

    const now = Date.now();
    const startsAt = challenge.start_date ? new Date(challenge.start_date).getTime() : null;
    const endsAt = challenge.submission_end_date ? new Date(challenge.submission_end_date).getTime() : null;

    if (challenge.status !== 'active') {
      return Response.json({ error: 'This challenge is not accepting submissions' }, { status: 409 });
    }
    if (startsAt && Number.isFinite(startsAt) && startsAt > now) {
      return Response.json({ error: 'Challenge submissions have not opened yet' }, { status: 409 });
    }
    if (endsAt && Number.isFinite(endsAt) && endsAt < now) {
      return Response.json({ error: 'Challenge submission deadline has passed' }, { status: 409 });
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
      remixFileUrl = post.file_url;
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
      if (parsed.protocol !== 'https:') {
        return Response.json({ error: 'Remix links must use HTTPS' }, { status: 400 });
      }
      remixFileUrl = externalUrl;
    }

    const deviceType = DEVICE_TYPES.has(body?.device_type) ? body.device_type : 'desktop';

    const submission = await entities.ChallengeSubmission.create({
      challenge_id: challenge.id,
      producer_id: user.id,
      producer_name: user.display_name || user.full_name || user.email || 'User',
      producer_avatar: user.avatar_url || null,
      remix_file_url: remixFileUrl,
      remix_name: remixName,
      description: String(body?.description || '').slice(0, 2000),
      source_type: sourceType,
      external_url: externalUrl || undefined,
      file_format: fileFormat || undefined,
      device_type: deviceType,
      status: 'approved',
      vote_count: 0,
    });

    return Response.json({ success: true, submission });
  } catch (error) {
    console.error('submitChallengeRemix error:', error);
    return Response.json({ error: error?.message || 'Could not submit remix' }, { status: 500 });
  }
});
