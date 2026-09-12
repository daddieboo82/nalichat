import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isTrustedStoredMediaUrl } from '../../shared/mediaSecurity.ts';

const MAX_TRANSCRIBE_BYTES = 50 * 1024 * 1024;

async function storedMediaSize(url: string): Promise<number | null> {
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
      if (match) return Number(match[1]);
      const length = Number(probe.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0 && probe.status !== 206) return length;
    }
    try { await probe.body?.cancel(); } catch {}
  } catch {}
  return null;
}

// Generates AI cover art for a track: transcribes audio, uses LLM to craft
// an image prompt, then generates the image. All three credit-costly
// integration calls run server-side under asServiceRole.
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const { allowed } = await requireEntitlement(
      base44.asServiceRole.entities,
      user.id,
      'ai.standard',
    );
    if (!allowed) {
      return Response.json({ error: 'Premium is required for AI cover art' }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'ai_cover_art',
      20,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { post_id } = await req.json();
    if (!post_id) {
      return Response.json({ error: 'post_id is required' }, { status: 400 });
    }

    const post = await base44.asServiceRole.entities.ArtPost.get(post_id);
    if (!post) {
      return Response.json({ error: 'Track not found' }, { status: 404 });
    }
    if (post.creator_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const file_url = post.file_url || '';
    const title = post.title || 'Untitled';
    const genre = post.genre || 'Unknown';
    const tags = Array.isArray(post.tags) ? post.tags : [];

    // Step 1: Transcribe only the media URL stored on the authorized track.
    let transcript = "No lyrics available.";
    if (file_url && !isTrustedStoredMediaUrl(file_url)) {
      return Response.json({ error: 'Stored track media host is not allowed' }, { status: 400 });
    }
    if (file_url) {
      const size = await storedMediaSize(file_url);
      if (size === null) {
        return Response.json({ error: 'Could not verify track size for AI cover art' }, { status: 400 });
      }
      if (size <= 0 || size > MAX_TRANSCRIBE_BYTES) {
        return Response.json({ error: 'AI cover-art transcription supports tracks up to 50MB' }, { status: 413 });
      }
      try {
        const rawTranscript = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url: file_url });
        const text = typeof rawTranscript === 'string' ? rawTranscript : rawTranscript?.text || '';
        transcript = text ? text.slice(0, 12000) : transcript;
      } catch (e) {
        console.error("Transcription failed:", e.message);
      }
    }

    // Step 2: Generate image prompt with LLM
    const prompt = `You are a visionary, avant-garde album cover designer.
Analyze the following track details:
Title: ${title || 'Untitled'}
Genre: ${genre || 'Unknown'}
Tags: ${tags ? tags.join(', ') : 'None'}
Lyrics/Vibe: ${transcript}

Create a highly detailed, breathtaking, and completely unique image generation prompt for an album cover that perfectly captures the mood and themes of this track.
CRITICAL: Do NOT include any text, typography, or words in the image itself. Focus entirely on the visual elements, lighting, style, and atmosphere.
Respond with ONLY the raw image generation prompt string, nothing else.`;

    const aiPrompt = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });

    // Step 3: Generate image
    const imgRes = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt: aiPrompt });
    if (!imgRes || !imgRes.url) throw new Error("Image generation failed");

    return Response.json({ image_url: imgRes.url });
  } catch (error) {
    console.error('generate-cover-art error:', error.message);
    return Response.json({ error: 'Cover art generation failed' }, { status: 500 });
  }
});