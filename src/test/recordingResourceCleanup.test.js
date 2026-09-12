// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Record page resource cleanup', () => {
  it('imports toast and cleans recording resources', async () => {
    const source = await readText('src/pages/Record.jsx');
    expect(source).toContain('import { toast } from "sonner";');
    expect(source).toContain('const audioCtxRef = useRef(null);');
    expect(source).toContain('if (timerRef.current) clearInterval(timerRef.current);');
    expect(source).toContain('URL.revokeObjectURL(recording.url)');
    expect(source).toContain('void audioCtxRef.current.close().catch(() => {})');
  });
});
