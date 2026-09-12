export class RequestBodyTooLargeError extends Error {
  status = 413;

  constructor(message = 'Request body too large') {
    super(message);
    this.name = 'RequestBodyTooLargeError';
  }
}

function contentLength(req: Request): number | null {
  const raw = req.headers.get('content-length');
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function readTextBodyLimited(req: Request, maxBytes: number): Promise<string> {
  const declared = contentLength(req);
  if (declared !== null && declared > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function readJsonBodyLimited<T = any>(req: Request, maxBytes: number): Promise<T> {
  const text = await readTextBodyLimited(req, maxBytes);
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export function requestBodyErrorResponse(error: unknown): Response | null {
  if (error instanceof RequestBodyTooLargeError) {
    return Response.json({ error: 'Request body too large' }, { status: 413 });
  }
  if (error instanceof SyntaxError) {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  return null;
}
