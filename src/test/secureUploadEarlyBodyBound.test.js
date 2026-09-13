import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('secure upload early body bound', () => {
  it('rejects oversized declared multipart bodies before req.formData()', async () => {
    const s = await readFile('base44/functions/secureUploadFile/entry.ts', 'utf8');
    const lengthCheck = s.indexOf("const declaredLength = Number(req.headers.get('content-length'))");
    const reject = s.indexOf("Upload request is too large", lengthCheck);
    const parse = s.indexOf('const form = await req.formData()', reject);

    expect(s).toContain('const MAX_MULTIPART_BYTES = MAX_BY_KIND.video + 1 * MB');
    expect(lengthCheck).toBeGreaterThan(-1);
    expect(reject).toBeGreaterThan(lengthCheck);
    expect(parse).toBeGreaterThan(reject);
  });
});
