import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { getSupabaseConfig } from '../../shared/supabase.ts';

const BUCKET = 'nalichat-transfers';

function safeFileName(value: unknown) {
  const raw = String(value || '').trim().slice(0, 255);
  const cleaned = raw.replace(/[^a-zA-Z0-9._ -]+/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned || 'file';
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(base44.asServiceRole.entities, user.id, 'resumable_transfer_create', 120);
    if (!rate.allowed) return Response.json({ error: 'Transfer rate limit exceeded. Please try again later.' }, { status: 429 });

    const body = await readJsonBodyLimited(req, 16 * 1024);
    const fileName = safeFileName(body?.file_name);
    const contentType = typeof body?.content_type === 'string' ? body.content_type.trim().slice(0, 255) : 'application/octet-stream';
    const fileSize = Number(body?.file_size);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return Response.json({ error: 'file_size must be greater than zero' }, { status: 400 });
    }

    // NaliChat intentionally has no application-level total transfer-size ceiling.
    const objectPath = `users/${user.id}/${crypto.randomUUID()}/${fileName}`;
    const { url, serviceKey } = getSupabaseConfig();
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(objectPath, { upsert: false });
    if (error || !data?.token) {
      console.error('createResumableTransferUpload signed URL error:', error);
      return Response.json({ error: 'Could not authorize transfer upload' }, { status: 502 });
    }

    const projectRef = new URL(url).hostname.split('.')[0];
    return Response.json({
      success: true,
      action: 'create_resumable_transfer_upload',
      userId: user.id,
      bucket: BUCKET,
      objectPath,
      fileName,
      fileSize,
      contentType,
      tusEndpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
      token: data.token,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('createResumableTransferUpload error:', error);
    return Response.json({ error: 'Could not authorize transfer upload' }, { status: 500 });
  }
});
