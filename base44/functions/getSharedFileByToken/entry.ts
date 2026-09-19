import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getSupabaseConfig } from '../../shared/supabase.ts';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function anonymousShareScope(req: Request): Promise<string> {
  const forwarded = String(
    req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')
    || '',
  ).split(',')[0].trim().slice(0, 128);
  const userAgent = String(req.headers.get('user-agent') || '').slice(0, 256);
  return 'share_read_' + await sha256Hex(`${forwarded || 'unknown'}:${userAgent || 'unknown'}`);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const TRUSTED_MEDIA_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
];

function isTrustedStoredUrl(value: unknown): boolean {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return TRUSTED_MEDIA_HOSTS.some((host) => hostname === host || hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const { fileId, token } = await readJsonBodyLimited(req, 8 * 1024);
    const normalizedFileId = String(fileId || '').trim();
    const normalizedToken = String(token || '').trim();
    if (
      !/^[0-9A-F]{24}$/i.test(normalizedFileId)
      || !/^[0-9a-f]{64}$/.test(normalizedToken)
    ) {
      return Response.json({ error: 'Invalid share link' }, { status: 400 });
    }

    const readScope = await anonymousShareScope(req);
    const readRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      readScope,
      'shared_file_token_read',
      120,
    );
    if (!readRate.allowed) {
      return Response.json(
        { error: 'Too many share-link attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const file = await base44.asServiceRole.entities.SharedFile.get(normalizedFileId);
    if (!file || !file.share_token_hash) {
      return Response.json({ error: 'Invalid or expired share link' }, { status: 404 });
    }
    if (file.share_token_expires_at && new Date(file.share_token_expires_at).getTime() <= Date.now()) {
      return Response.json({ error: 'Invalid or expired share link' }, { status: 404 });
    }

    const candidate = await sha256Hex(normalizedToken);
    if (!constantTimeEqual(candidate, String(file.share_token_hash))) {
      return Response.json({ error: 'Invalid or expired share link' }, { status: 404 });
    }
    let downloadUrl = file.file_url;
    if (
      file.storage_provider === 'supabase'
      && file.storage_bucket === 'nalichat-transfers'
      && typeof file.storage_path === 'string'
      && file.storage_path.startsWith(`users/${file.uploader_id}/`)
      && !file.storage_path.includes('..')
    ) {
      const { url, serviceKey } = getSupabaseConfig();
      const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: signed, error: signedError } = await supabase.storage
        .from(file.storage_bucket)
        .createSignedUrl(file.storage_path, 15 * 60);
      if (signedError || !signed?.signedUrl) {
        console.error('getSharedFileByToken signed URL error:', signedError);
        return Response.json({ error: 'Could not authorize shared-file download' }, { status: 502 });
      }
      downloadUrl = signed.signedUrl;
    } else if (!isTrustedStoredUrl(downloadUrl)) {
      return Response.json({ error: 'Shared file media host is not allowed' }, { status: 400 });
    }

    return Response.json({
      success: true,
      action: 'get_shared_file_by_token',
      fileId: normalizedFileId,
      tokenFingerprint: candidate.slice(0, 16),
      file: {
        id: file.id,
        name: file.name,
        file_url: downloadUrl,
        file_type: file.file_type,
        file_size: file.file_size,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('getSharedFileByToken error:', error);
    return Response.json({ error: 'Could not load shared file' }, { status: 500 });
  }
});
