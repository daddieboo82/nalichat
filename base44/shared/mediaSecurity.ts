export const TRUSTED_MEDIA_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
];

export function isTrustedStoredMediaUrl(value: unknown): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return TRUSTED_MEDIA_HOSTS.some(
      (host) => hostname === host || hostname.endsWith('.' + host),
    );
  } catch {
    return false;
  }
}
