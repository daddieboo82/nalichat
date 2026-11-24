// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai saved conversation recovery', () => {
  it('bounds a stuck restore lookup without abandoning the saved conversation ID', async () => {
    const source = await read();
    const start = source.indexOf('const createOrRestoreConversation = async () => {');
    const end = source.indexOf('// Deduplicate simultaneous open', start);
    const restore = source.slice(start, end);
    expect(restore).toContain('await withNaliHistoryTimeout(base44.agents.getConversation(savedId))');
    expect(restore).toContain('if (status !== 404 && status !== 410) {');
    expect(restore).toContain('throw error;');
    expect(restore.indexOf('throw error;')).toBeLessThan(restore.indexOf('sessionStorage.removeItem(conversationStorageKey)'));
    expect(restore.indexOf('sessionStorage.removeItem(conversationStorageKey)')).toBeLessThan(restore.indexOf('base44.agents.createConversation('));
  });
  it('creates a new conversation only after a confirmed unavailable or invalid stored chat', async () => {
    const source = await read();
    expect(source).toContain('if (status !== 404 && status !== 410)');
    expect(source).toContain('if (!restored?.id || restored.id !== savedId) {');
    expect(source).toContain("throw new Error('Saved NALI.ai conversation returned incomplete data');");
    expect(source).toContain('if (!restored.created_by_id || restored.created_by_id === user?.id) {');
    expect(source).toContain('if (generation !== identityGenerationRef.current) throw staleIdentityError();');
  });
  it('never resends a message while checking previous chat history', async () => {
    const source = await read();
    const restore = source.slice(source.indexOf('const createOrRestoreConversation = async () => {'), source.indexOf('// Deduplicate simultaneous open'));
    expect(restore).not.toContain('sendAgentText(');
    expect(restore).not.toContain('sendText(');
  });
});
