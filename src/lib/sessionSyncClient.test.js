import { describe, expect, it, vi } from 'vitest';
import { analyzeSharedSessionTracks } from './sessionSyncClient';
import { readFile } from 'node:fs/promises';

const guide = Float32Array.from({ length: 80000 }, (_, i) => Math.sin(i / 11) * .13);
const fakeAudio = {
  numberOfChannels: 1,
  sampleRate: 8000,
  duration: 10,
  getChannelData: () => guide,
};
function contextFactory(onClose) {
  return class AudioContextMock {
    state = 'running';
    async decodeAudioData() { return fakeAudio; }
    async close() { this.state = 'closed'; onClose?.(); }
  };
}
const response = () => ({
  ok: true,
  headers: { get: () => '80000' },
  arrayBuffer: async () => new ArrayBuffer(80000),
});
const reference = { id: 'ref', audioUrl: 'https://cdn.example/reference.wav', start_time: 0 };
const target = { id: 'target', audioUrl: 'https://cdn.example/target.wav', start_time: .3 };

describe('remote Sync Assist workflow', () => {
  it('analyzes authorized existing track URLs locally in a worker and cleans up the audio context', async () => {
    const fetchImpl = vi.fn(async () => response());
    const close = vi.fn();
    const worker = {
      terminate: vi.fn(),
      postMessage: vi.fn(function(data) {
        expect(data.type).toBe('analyze');
        expect(data.targetStart).toBe(.3);
        queueMicrotask(() => this.onmessage?.({data:{type:'result',result:{valid:true,suggestedStart:.4}}}));
      }),
    };
    const output = await analyzeSharedSessionTracks(reference, target, {
      fetchImpl, workerFactory: () => worker, AudioContextType: contextFactory(close),
    });
    expect(output).toMatchObject({valid:true,suggestedStart:.4});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects duplicate selections before accessing recorded content', async () => {
    const fetchImpl = vi.fn();
    await expect(analyzeSharedSessionTracks(reference, reference, { fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses files exceeding the safe size and releases the decoder', async () => {
    const close = vi.fn();
    await expect(analyzeSharedSessionTracks(reference, target, {
      fetchImpl: async () => ({ok:true,headers:{get:() => String(31*1024*1024)}}),
      AudioContextType: contextFactory(close),
    })).rejects.toThrow(/too large/);
    expect(close).toHaveBeenCalled();
  });

  it('does not introduce silent changes to server track timing', async () => {
    const editor = await readFile('src/components/studio/SharedSessionSyncAssist.jsx', 'utf8');
    const viewer = await readFile('src/components/messages/ChatSessionViewer.jsx', 'utf8');
    expect(editor).toContain('window.confirm(');
    expect(editor).toContain('onTrackUpdate(target.id, { start_time: result.suggestedStart })');
    expect(editor).toContain('if (!result?.valid');
    expect(viewer).toContain('enableSyncAssist');
  });
});
