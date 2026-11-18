import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { encodeBase64, decodeBase64 } from 'jsr:@std/encoding@1.0.10/base64';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

const AUDIO_LIMIT = 2_000_000;
const REQUEST_LIMIT = 5_500_000;
const statusResponse = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
const reply = (error: string, status: number) => Response.json({ error }, { status });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply('Method not allowed.', 405);
  try {
    const client = createClientFromRequest(request);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id || user.is_banned) return reply('Sign in to generate a voice.', 401);

    const address = Deno.env.get('VOXSHIFT_PROVIDER_URL');
    const key = Deno.env.get('VOXSHIFT_API_KEY');
    if (!address || !key) return reply('VoxShift AI is awaiting provider setup.', 503);
    const origin = new URL(address);
    if (origin.protocol !== 'https:' || origin.username || origin.password) {
      return reply('VoxShift AI needs a valid HTTPS provider URL.', 503);
    }

    const payload = await readJsonBodyLimited(request, REQUEST_LIMIT);
    const headers = { Authorization: `Bearer ${key}`, 'X-VoxShift-Owner': user.id };
    if (payload?.action === 'capabilities') {
      const upstream = await fetch(new URL('/v1/capabilities', origin), {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      if (!upstream.ok) return reply('Voice Match provider is unavailable.', 503);
      const { modes } = await upstream.json();
      const available = Array.isArray(modes) ? ['sing', 'convert', 'speech'].filter(mode => modes.includes(mode)) : [];
      if (!available.length) return reply('Voice Match provider is unavailable.', 503);
      return statusResponse({ modes: available });
    }
    if (payload?.action === 'status') {
      if (typeof payload.jobId !== 'string' || !/^[a-f0-9]{32}$/.test(payload.jobId)) {
        return reply('Invalid voice job.', 400);
      }
      const upstream = await fetch(new URL(`/v1/jobs/${payload.jobId}`, origin), {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(12_000),
      });
      if (upstream.status === 404) return reply('The voice job expired or the provider restarted.', 404);
      if (!upstream.ok) return reply('Voice job status is temporarily unavailable.', 502);
      if (upstream.headers.get('content-type')?.split(';')[0] === 'application/json') {
        const { status } = await upstream.json();
        if (!['queued', 'running', 'failed'].includes(status)) return reply('Invalid voice job status.', 502);
        return statusResponse({ status });
      }
      return await readRenderedAudio(upstream);
    }

    if (!payload || payload.consent !== true || !['speech', 'convert', 'sing'].includes(payload.mode)) {
      return reply('Choose a mode and confirm permission to use the reference voice.', 400);
    }
    const form = new FormData();
    form.set('consent', 'confirmed');
    for (const field of payload.mode === 'speech' ? ['reference'] : ['reference', 'source']) {
      const value = payload[field];
      if (typeof value !== 'string' || value.length > Math.ceil(AUDIO_LIMIT / 3) * 4) {
        return reply('Audio exceeds the Studio voice limit.', 413);
      }
      let audio: Uint8Array;
      try { audio = decodeBase64(value); } catch { return reply('Invalid audio encoding.', 400); }
      if (audio.length < 44 || audio.length > AUDIO_LIMIT) return reply('Invalid WAV size.', 400);
      form.set(field, new Blob([audio], { type: 'audio/wav' }), `${field}.wav`);
    }
    if (payload.mode === 'speech') {
      const text = typeof payload.text === 'string' ? payload.text.trim() : '';
      if (!text || text.length > 400) return reply('Enter up to 400 characters.', 400);
      form.set('text', text);
    }

    const rate = await consumeHourlyLimit(client.asServiceRole.entities, user.id, 'voxshift_generate', 8);
    if (!rate.allowed) return reply('Hourly generation limit reached. Try again later.', 429);
    const upstream = await fetch(new URL(`/v1/jobs/${payload.mode}`, origin), {
      method: 'POST',
      headers,
      body: form,
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (upstream.status === 503) return reply('VoxShift AI is busy. Try again in a moment.', 503);
    if (upstream.status === 422) return reply('The provider rejected the audio or text.', 422);
    if (upstream.status !== 202) return reply('The provider could not start the voice job.', 502);
    const { jobId } = await upstream.json();
    if (typeof jobId !== 'string' || !/^[a-f0-9]{32}$/.test(jobId)) return reply('Invalid voice job.', 502);
    return statusResponse({ status: 'queued', jobId });
  } catch (error) {
    return requestBodyErrorResponse(error) ?? reply('VoxShift AI could not complete the request.', 502);
  }
});

async function readRenderedAudio(upstream: Response) {
  const length = Number(upstream.headers.get('content-length'));
  if (upstream.headers.get('content-type')?.split(';')[0] !== 'audio/wav'
    || !Number.isSafeInteger(length) || length < 44 || length > AUDIO_LIMIT) {
    await upstream.body?.cancel();
    return reply('The provider returned an invalid audio file.', 502);
  }
  const audio = await upstream.arrayBuffer();
  if (audio.byteLength !== length) return reply('The provider returned incomplete audio.', 502);
  return statusResponse({ status: 'complete', wav: encodeBase64(audio) });
}
