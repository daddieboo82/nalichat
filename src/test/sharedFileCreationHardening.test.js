// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('shared file creation hardening', () => {
  it('validates method/account state and rejects malformed or oversized metadata', async () => {
    const source = await readText('base44/functions/createSharedFileRecord/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source.indexOf('user.is_banned')).toBeLessThan(
      source.indexOf('await consumeHourlyLimit'),
    );
    expect(source).toContain("typeof body?.name !== 'string'");
    expect(source).toContain("typeof body?.file_url !== 'string'");
    expect(source).toContain("typeof body.description !== 'string'");
    expect(source).toContain('name.length > 255');
    expect(source).toContain('description.length > 1000');
    expect(source).toContain('projectId && !isBase44EntityId(projectId)');
    expect(source).toContain('folderId && !isBase44EntityId(folderId)');
    expect(source).not.toContain('slice(0, 255)');
    expect(source).not.toContain('slice(0, 1000)');
  });
});


  it('binds file creation confirmation to the authenticated uploader and exact file', async () => {
    const backend = await readText('base44/functions/createSharedFileRecord/entry.ts');
    expect(backend).toContain("action: 'create_shared_file'");
    expect(backend).toContain('userId: user.id');
    expect(backend).toContain('fileId: file.id');
  });
