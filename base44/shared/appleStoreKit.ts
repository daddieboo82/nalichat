import { X509Certificate } from 'node:crypto';

/**
 * Local verification of a StoreKit 2 signed transaction (JWS).
 *
 * Apple signs every transaction with a certificate chain that ends at a pinned
 * Apple root, and the app already holds that signed string. Verifying it here
 * proves the purchase without any App Store Connect key or shared secret:
 *   1. the chain must terminate at a pinned Apple root fingerprint,
 *   2. each certificate must be issued and signed by the next one up,
 *   3. the JWS signature must verify with the leaf certificate's public key,
 *   4. the payload's bundleId must be one of this app's bundle IDs.
 */

/** SHA-256 fingerprints of Apple's published root certificates. */
export const APPLE_ROOT_CA_FINGERPRINTS = new Set([
  // Apple Root CA - G3 (EC P-384, valid to 2039)
  '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79',
  // Apple Root CA - G2 (RSA 2048, valid to 2039)
  'C2:B9:B0:42:DD:57:83:0E:7D:11:7D:AC:55:AC:8A:E1:94:07:D3:8E:41:D8:8F:32:15:BC:3A:89:04:44:A0:50',
]);

export interface StoreKitTransaction {
  bundleId: string;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  expiresDate: number;
  purchaseDate: number;
  environment: string;
  type: string;
}

export type StoreKitVerifyResult =
  | { ok: true; transaction: StoreKitTransaction }
  | { ok: false; reason: string };

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeSegment(segment: string): Uint8Array {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return decodeBase64(padded);
}

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeSegment(segment)));
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function verifyStoreKitTransaction(
  jws: string,
  options: { bundleIds: string[] },
): Promise<StoreKitVerifyResult> {
  if (typeof jws !== 'string' || jws.length < 32) {
    return { ok: false, reason: 'missing_signed_transaction' };
  }

  const parts = jws.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed_jws' };

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJson(parts[0]);
    payload = decodeJson(parts[1]);
  } catch {
    return { ok: false, reason: 'undecodable_jws' };
  }

  if (header.alg !== 'ES256') return { ok: false, reason: 'unsupported_algorithm' };

  const chain = header.x5c;
  if (!Array.isArray(chain) || chain.length < 2) return { ok: false, reason: 'missing_certificate_chain' };

  let certificates: X509Certificate[];
  try {
    certificates = chain.map((entry) => new X509Certificate(Buffer.from(String(entry), 'base64')));
  } catch (error) {
    console.error('Apple JWS certificate parsing failed', error);
    return { ok: false, reason: 'unreadable_certificate' };
  }

  const leaf = certificates[0];
  const root = certificates[certificates.length - 1];

  // The root must be a pinned Apple root. Subject names are attacker-controlled
  // inside the JWS, so only the fingerprint is allowed to establish trust.
  if (!APPLE_ROOT_CA_FINGERPRINTS.has(root.fingerprint256)) {
    return { ok: false, reason: 'untrusted_root' };
  }

  if (typeof leaf.checkIssued !== 'function' || typeof leaf.verify !== 'function') {
    return { ok: false, reason: 'x509_verification_unavailable' };
  }

  // Every certificate must actually be issued and signed by the next one up.
  for (let i = 0; i < certificates.length - 1; i += 1) {
    const child = certificates[i];
    const issuer = certificates[i + 1];
    if (!child.checkIssued(issuer)) return { ok: false, reason: 'chain_issuer_mismatch' };
    if (!child.verify(issuer.publicKey)) return { ok: false, reason: 'chain_signature_invalid' };
  }

  // Verify the JWS itself with the leaf certificate's public key.
  try {
    const spki = new Uint8Array(leaf.publicKey.export({ type: 'spki', format: 'der' }) as ArrayBufferLike);
    const key = await crypto.subtle.importKey(
      'spki',
      spki,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const signatureValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      decodeSegment(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!signatureValid) return { ok: false, reason: 'invalid_signature' };
  } catch (error) {
    console.error('Apple JWS signature verification failed', error);
    return { ok: false, reason: 'signature_check_error' };
  }

  const bundleId = String(payload.bundleId || '');
  const allowedBundleIds = options.bundleIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
  if (!allowedBundleIds.includes(bundleId)) return { ok: false, reason: 'bundle_mismatch' };

  const productId = String(payload.productId || '');
  const transactionId = String(payload.transactionId || '');
  if (!productId || !transactionId) return { ok: false, reason: 'incomplete_payload' };

  return {
    ok: true,
    transaction: {
      bundleId,
      productId,
      transactionId,
      originalTransactionId: String(payload.originalTransactionId || transactionId),
      expiresDate: asNumber(payload.expiresDate),
      purchaseDate: asNumber(payload.purchaseDate),
      environment: String(payload.environment || ''),
      type: String(payload.type || ''),
    },
  };
}