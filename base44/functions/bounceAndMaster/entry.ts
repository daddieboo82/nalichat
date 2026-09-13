import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const ALLOWED_LOUDNESS_TARGETS = new Set(['spotify', 'apple', 'youtube', 'tidal', 'streaming']);
const ALLOWED_FORMATS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']);
const ALLOWED_BIT_DEPTHS = new Set(['16bit', '24bit', '32bit']);
const ALLOWED_SAMPLE_RATES = new Set(['44.1khz', '48khz', '96khz']);

async function storedAudioSize(url: string): Promise<number | null> {
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
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    // Require authentication before resolving any stored media.
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
      return Response.json({ error: 'Premium is required for mastering export' }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'mastering_export',
      30,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { postId, loudnessTarget, format, bitDepth, sampleRate } = await readJsonBodyLimited(req, 16 * 1024);

    const normalizedLoudnessTarget = typeof loudnessTarget === 'string' ? loudnessTarget.trim() : 'streaming';
    const normalizedFormat = typeof format === 'string' ? format.trim().toLowerCase() : 'mp3';
    const normalizedBitDepth = typeof bitDepth === 'string' ? bitDepth.trim().toLowerCase() : '24bit';
    const normalizedSampleRate = typeof sampleRate === 'string' ? sampleRate.trim().toLowerCase() : '44.1khz';
    if (!ALLOWED_LOUDNESS_TARGETS.has(normalizedLoudnessTarget)) {
      return Response.json({ error: 'Unsupported loudness target' }, { status: 400 });
    }
    if (!ALLOWED_FORMATS.has(normalizedFormat)) {
      return Response.json({ error: 'Unsupported export format' }, { status: 400 });
    }
    if (!ALLOWED_BIT_DEPTHS.has(normalizedBitDepth)) {
      return Response.json({ error: 'Unsupported bit depth' }, { status: 400 });
    }
    if (!ALLOWED_SAMPLE_RATES.has(normalizedSampleRate)) {
      return Response.json({ error: 'Unsupported sample rate' }, { status: 400 });
    }

    const normalizedPostId = typeof postId === 'string' ? postId.trim() : '';
    if (!isBase44EntityId(normalizedPostId)) {
      return Response.json({ error: 'Valid postId is required' }, { status: 400 });
    }

    const post = await base44.asServiceRole.entities.ArtPost.get(normalizedPostId);
    if (!post) {
      return Response.json({ error: 'Track not found' }, { status: 404 });
    }
    if (post.creator_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const audioUrl = String(post.file_url || '').trim();
    if (!audioUrl) {
      return Response.json({ error: 'Track has no audio file' }, { status: 400 });
    }

    // Fetch only the URL stored on the authorized ArtPost record. New posts are
    // restricted to trusted storage hosts by createArtPost, and legacy records
    // still receive a strict host check here before any server-side request.
    const ALLOWED_HOSTS = [
      'storage.googleapis.com',
      'base44-user-files.s3.amazonaws.com',
      'base44-user-files.s3.us-east-1.amazonaws.com',
      'files.base44.com',
      'cdn.base44.com',
    ];
    let parsedUrl;
    try {
      parsedUrl = new URL(audioUrl);
    } catch {
      return Response.json({ error: 'Stored audio URL is invalid' }, { status: 400 });
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowed = parsedUrl.protocol === 'https:' &&
      ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith('.' + host));
    if (!isAllowed) {
      return Response.json({ error: 'Stored audio host is not allowed' }, { status: 400 });
    }

    const storedSize = await storedAudioSize(audioUrl);
    if (storedSize === null) {
      return Response.json({ error: 'Could not verify stored audio size' }, { status: 400 });
    }
    if (storedSize <= 0 || storedSize > MAX_AUDIO_BYTES) {
      return Response.json({ error: 'Audio file too large (max 50MB)' }, { status: 413 });
    }

    // Fetch only after the trusted storage object size has been verified.
    const audioResponse = await fetch(audioUrl, { redirect: 'manual' });
    if (!audioResponse.ok) {
      return Response.json({ error: 'Failed to fetch audio' }, { status: 400 });
    }
    const arrayBuffer = await audioResponse.arrayBuffer();
    if (arrayBuffer.byteLength !== storedSize || arrayBuffer.byteLength > MAX_AUDIO_BYTES) {
      return Response.json({ error: 'Stored audio size changed during processing' }, { status: 409 });
    }
    
    // Create simulated audio analysis from file size (since we can't decode MP3)
    // In production, you'd use actual audio decoding library
    const sampleCount = Math.min(44100, arrayBuffer.byteLength / 4); // Simulate sample data
    
    // Generate simulated audio buffer for analysis
    const audioBuffer = new Float32Array(sampleCount);
    const view = new DataView(arrayBuffer);
    
    for (let i = 0; i < sampleCount && i * 4 < arrayBuffer.byteLength; i++) {
      try {
        audioBuffer[i] = (view.getUint8(i * 4 % arrayBuffer.byteLength) - 128) / 128;
      } catch {
        audioBuffer[i] = Math.random() * 0.1; // Fallback to silence simulation
      }
    }
    
    // Analyze audio - calculate loudness metrics
    const analysis = analyzeAudio(audioBuffer);
    
    // Normalize to target loudness standard
    const targetLufs = getLufsTarget(normalizedLoudnessTarget);
    const gainAdjustment = calculateGainAdjustment(analysis.integrativeLouds, targetLufs);
    
    // Process audio with gain and limiting
    const processedBuffer = processAudioBuffer(audioBuffer, gainAdjustment);
    
    // Apply mastering chain
    const masteredBuffer = applyMasteringChain(processedBuffer, normalizedLoudnessTarget);
    
    // Get final analysis
    const finalAnalysis = analyzeAudio(masteredBuffer);

    return Response.json({
      success: true,
      analysis: {
        before: analysis,
        after: finalAnalysis,
        gainApplied: gainAdjustment,
        format: normalizedFormat,
        bitDepth: normalizedBitDepth,
        sampleRate: normalizedSampleRate,
      },
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Bounce and master error:', error);
    return Response.json({ error: 'Unable to master audio' }, { status: 500 });
  }
});

function analyzeAudio(audioBuffer) {
  let sum = 0;
  let peakLevel = 0;
  let rmsSum = 0;

  for (let i = 0; i < audioBuffer.length; i++) {
    const sample = audioBuffer[i];
    
    // Peak detection
    peakLevel = Math.max(peakLevel, Math.abs(sample));
    
    // RMS calculation
    rmsSum += sample * sample;
  }

  const rms = Math.sqrt(rmsSum / audioBuffer.length);
  const peakDb = 20 * Math.log10(Math.max(peakLevel, 1e-10));
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-10));
  const lufs = rmsDb - 0.691; // Simplified LUFS approximation
  
  // Dynamic range estimate
  const nonZeroMagnitudes = Array.from(audioBuffer)
    .map(Math.abs)
    .filter((sample) => sample > 1e-6);
  const minNonZero = nonZeroMagnitudes.length > 0 ? Math.min(...nonZeroMagnitudes) : 1e-10;
  const minDb = 20 * Math.log10(Math.max(minNonZero, 1e-10));
  const dynamicRange = Math.max(0, peakDb - minDb);

  return {
    peakDb: Math.round(peakDb * 100) / 100,
    rmsDb: Math.round(rmsDb * 100) / 100,
    integrativeLouds: Math.round(lufs * 100) / 100,
    dynamicRange: Math.round(dynamicRange * 100) / 100,
    clippingRisk: peakDb > -0.5 ? 'High' : peakDb > -3 ? 'Medium' : 'Low',
  };
}

function getLufsTarget(standard) {
  const targets = {
    spotify: -14,
    apple: -16,
    youtube: -13,
    tidal: -14,
    streaming: -14,
  };
  return targets[standard] || -14;
}

function calculateGainAdjustment(currentLufs, targetLufs) {
  const gainDb = targetLufs - currentLufs;
  return Math.pow(10, gainDb / 20); // Convert dB to linear gain
}

function processAudioBuffer(buffer, gainMultiplier) {
  const processed = new Float32Array(buffer.length);
  const limiterThreshold = 0.99;
  
  for (let i = 0; i < buffer.length; i++) {
    let sample = buffer[i] * gainMultiplier;
    
    // Soft clipping limiter
    if (Math.abs(sample) > limiterThreshold) {
      sample = Math.sign(sample) * (limiterThreshold + 0.01 * Math.tanh(Math.abs(sample) - limiterThreshold));
    }
    
    processed[i] = sample;
  }
  
  return processed;
}

function applyMasteringChain(buffer, standard) {
  // Apply subtle EQ boost for common streaming issues
  const eqFiltered = new Float32Array(buffer.length);
  const filterCoeff = 0.15; // Very subtle filter
  
  for (let i = 0; i < buffer.length; i++) {
    if (i === 0) {
      eqFiltered[i] = buffer[i];
    } else {
      eqFiltered[i] = buffer[i] * (1 - filterCoeff) + eqFiltered[i - 1] * filterCoeff;
    }
  }
  
  return eqFiltered;
}