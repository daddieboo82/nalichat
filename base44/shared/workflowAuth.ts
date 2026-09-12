async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function validWorkflowKey(
  value: unknown,
  expectedSha256: string,
): Promise<boolean> {
  if (typeof value !== 'string' || value.length < 32 || value.length > 256) return false;
  const actual = await sha256Hex(value);
  return constantTimeEqual(actual, expectedSha256);
}
