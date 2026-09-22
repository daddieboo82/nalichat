import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { InferenceClient } from 'npm:@huggingface/inference';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

const MODEL = 'Wan-AI/Wan2.1-T2V-1.3B';
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    const { prompt, negative_prompt } = await readJsonBodyLimited(req, 12 * 1024);
    const text = typeof prompt === 'string' ? prompt.trim().slice(0, 5000) : '';
    if (!text) return Response.json({ error: 'Scene prompt is required' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('hugging_face');
    const hf = new InferenceClient(accessToken);
    const video = await hf.textToVideo({
      provider: 'auto',
      model: MODEL,
      inputs: text,
      parameters: {
        num_frames: 81,
        guidance_scale: 5,
        num_inference_steps: 28,
        negative_prompt: [String(negative_prompt || 'text, logo, watermark, celebrity likeness, distorted anatomy, low quality')],
      },
    });
    const bytes = new Uint8Array(await video.arrayBuffer());
    if (!bytes.length) throw new Error('Video provider returned an empty clip');
    const file = new File([bytes], `scene-${crypto.randomUUID()}.mp4`, { type: video.type || 'video/mp4' });
    const stored = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    if (!stored?.file_url) throw new Error('Generated clip could not be stored');
    return Response.json({ video_url: stored.file_url, model: MODEL });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error); if (bodyError) return bodyError;
    console.error('generateMusicVideoClip error:', error);
    return Response.json({ error: error instanceof Error ? error.message : 'AI video generation failed' }, { status: 500 });
  }
});