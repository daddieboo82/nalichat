import { describe, expect, it } from 'vitest';
import { studioDesktopHandoffUrl } from './studioDesktopHandoff';
import { readFile } from 'node:fs/promises';

describe('Mobile Studio -> desktop handoff', () => {
  it('provides an owner-scoped project URL without exposing an invite token', () => {
    expect(studioDesktopHandoffUrl('6a1f5ee134147461560c2b37'))
      .toBe('https://nalichat.org/studio?room=6a1f5ee134147461560c2b37');
    expect(studioDesktopHandoffUrl('private-project-id','https://nalichat.base44.app'))
      .toBe('https://nalichat.base44.app/studio?room=private-project-id');
  });
  it('rejects empty or malformed IDs and insecure links', () => {
    for (const value of ['', '../../billing', 'bad?invite=x', 'x']) {
      expect(() => studioDesktopHandoffUrl(value)).toThrow();
    }
    expect(() => studioDesktopHandoffUrl('properid123','http://nalichat.org')).toThrow();
  });
  it('only displays the handoff after a confirmed cloud save and never while recording', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    expect(source).toContain('const saved = await handleSave()');
    expect(source).toContain('if (!saved) return;');
    expect(source).toContain('lastSavedStudioProjectRef.current = targetProjectId;');
    expect(source).toContain('if (isRecording || microphoneStartupRef.current.pending || recordingFinalizeInFlightRef.current)');
    expect(source).toContain('studioDesktopHandoffUrl(savedId)');
    expect(source).toContain('setMobileDesktopHandoffUrl(link)');
    expect(source).toContain('copyToClipboard(link)');
    expect(source).toContain('Private to your account.');
  });
});
