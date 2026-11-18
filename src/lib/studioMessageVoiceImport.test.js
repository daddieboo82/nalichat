import { describe, expect, it, vi } from 'vitest';
import { fetchAuthorizedStudioVoiceMessage } from './studioMessageVoiceImport';

const id = '6a1f5ee134147461560c2b37';
const valid = () => ({
  data: {
    success: true,
    action: 'authorize_message_download',
    messageId: id,
    userId: 'member-a',
    conversationId: 'conversation-1',
    file_url: 'https://signed.example.com/voice.webm',
    file_name: 'Voice Message',
  },
});

describe('Voice messages enter Studio by explicit, authorized action', () => {
  it('imports authorized audio, preserving its source as a new local file', async () => {
    const invoke = vi.fn(async () => valid());
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: { get: () => '2048' },
      blob: async () => new Blob([new Uint8Array(2048)], { type: 'audio/webm' }),
    }));
    const file = await fetchAuthorizedStudioVoiceMessage(id, 'member-a', { invoke, fetchImpl });
    expect(file).toBeInstanceOf(File);
    expect(file.name).toMatch(/^Message Voice/);
    expect(file.size).toBe(2048);
    expect(invoke).toHaveBeenCalledWith('authorizeMessageDownload', { messageId: id });
    expect(fetchImpl).toHaveBeenCalledWith('https://signed.example.com/voice.webm', { credentials: 'omit' });
  });

  it('rejects an unauthorized or mismatched identity without fetching audio', async () => {
    const invoke = vi.fn(async () => ({ ...valid(), data: { ...valid().data, userId: 'other' } }));
    const fetchImpl = vi.fn();
    await expect(fetchAuthorizedStudioVoiceMessage(id, 'member-a', { invoke, fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects unsigned URLs, oversized audio and non-audio MIME', async () => {
    const invoke = vi.fn(async () => ({ ...valid(), data: { ...valid().data, file_url: 'http://untrusted.example/a' } }));
    await expect(fetchAuthorizedStudioVoiceMessage(id, 'member-a', { invoke })).rejects.toThrow();
    const sizeResponse = {
      ok: true,
      headers: { get: () => String(51 * 1024 * 1024) },
      blob: vi.fn(),
    };
    await expect(fetchAuthorizedStudioVoiceMessage(id, 'member-a', {
      invoke: async () => valid(), fetchImpl: async () => sizeResponse,
    })).rejects.toThrow(/limit/);
    expect(sizeResponse.blob).not.toHaveBeenCalled();
    await expect(fetchAuthorizedStudioVoiceMessage(id, 'member-a', {
      invoke: async () => valid(),
      fetchImpl: async () => ({ ok: true, headers: { get: () => null }, blob: async () => new Blob(['not audio'], { type: 'text/html' }) }),
    })).rejects.toThrow(/not an audio/);
  });

  it('does not accept arbitrary identifiers', async () => {
    const invoke = vi.fn();
    await expect(fetchAuthorizedStudioVoiceMessage('javascript:alert(1)', 'member-a', { invoke })).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
});
