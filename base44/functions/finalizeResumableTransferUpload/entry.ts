import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { getSupabaseConfig } from '../../shared/supabase.ts';

const BUCKET = 'nalichat-transfers';

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

    const body = await readJsonBodyLimited(req, 16 * 1024);
    const objectPath = typeof body?.objectPath === 'string' ? body.objectPath.trim() : '';
    const requiredPrefix = `users/${user.id}/`;
    if (!objectPath || !objectPath.startsWith(requiredPrefix) || objectPath.includes('..')) {
      return Response.json({ error: 'Invalid transfer object path' }, { status: 400 });
    }

    const { url, serviceKey } = getSupabaseConfig();
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const slash = objectPath.lastIndexOf('/');
    const folder = objectPath.slice(0, slash);
    const name = objectPath.slice(slash + 1);
    const { data: objects, error: listError } = await supabase.storage.from(BUCKET).list(folder, {
      search: name,
      limit: 10,
    });
    if (listError) {
      console.error('finalizeResumableTransferUpload list error:', listError);
      return Response.json({ error: 'Could not verify transfer' }, { status: 502 });
    }
    const object = (objects || []).find((item) => item.name === name);
    if (!object) return Response.json({ error: 'Uploaded transfer was not found' }, { status: 404 });

    const storedSize = Number(object.metadata?.size);
    if (!Number.isFinite(storedSize) || storedSize <= 0) {
      return Response.json({ error: 'Uploaded transfer size could not be verified' }, { status: 409 });
    }

    // Short-lived private URL. Persistent records should retain bucket/path and
    // mint a fresh authorized URL when downloaded.
    const { data: signed, error: signedError } = await supabase.storage.from(BUCKET)
      .createSignedUrl(objectPath, 15 * 60);
    if (signedError || !signed?.signedUrl) {
      console.error('finalizeResumableTransferUpload signed URL error:', signedError);
      return Response.json({ error: 'Could not authorize transfer download' }, { status: 502 });
    }

    return Response.json({
      success: true,
      action: 'finalize_resumable_transfer_upload',
      userId: user.id,
      bucket: BUCKET,
      objectPath,
      fileSize: storedSize,
      file_url: signed.signedUrl,
      expiresIn: 15 * 60,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('finalizeResumableTransferUpload error:', error);
    return Response.json({ error: 'Could not finalize transfer' }, { status: 500 });
  }
});
