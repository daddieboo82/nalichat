import { describe, expect, it, vi } from 'vitest';
import { createLosslessStudioRecorder } from './studioPcmRecorder';

async function makeRecorder() {
  let node;
  class Context {
    constructor() {
      this.sampleRate = 48000;
      this.destination = {};
      this.audioWorklet = { addModule: async () => {} };
    }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  class WorkletNode {
    constructor() {
      node = this;
      this.port = { postMessage() {}, onmessage: null, onmessageerror: null };
    }
    connect() {}
    disconnect() {}
  }
  const recorder = await createLosslessStudioRecorder({}, {
    AudioContextType: Context, WorkletNodeType: WorkletNode,
  });
  recorder.start();
  node.port.onmessage({ data: { type: 'pcm', buffer: new Int16Array([1, 2, 3]).buffer } });
  return { recorder, node };
}

describe('Studio PCM callback isolation during shutdown', () => {
  it('delivers stop even when partial audio and error callbacks both throw', async () => {
    const { recorder, node } = await makeRecorder();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const events = [];
      recorder.ondataavailable = () => { events.push('data'); throw new Error('data callback'); };
      recorder.onerror = () => { events.push('error'); throw new Error('error callback'); };
      recorder.onstop = () => { events.push('stop'); };
      node.port.onmessageerror();
      await vi.waitFor(() => expect(events).toEqual(['data', 'error', 'stop']));
      expect(recorder.state).toBe('inactive');
      expect(warning).toHaveBeenCalledTimes(2);
    } finally {
      warning.mockRestore();
    }
  });

  it('cleans up and prevents repeated callbacks even when stop handler throws', async () => {
    const { recorder, node } = await makeRecorder();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const stopped = vi.fn(() => { throw new Error('stop callback'); });
      recorder.onstop = stopped;
      node.port.onmessageerror();
      await vi.waitFor(() => expect(stopped).toHaveBeenCalledOnce());
      node.port.onmessageerror();
      node.port.onmessage({ data: { type: 'flushed' } });
      expect(stopped).toHaveBeenCalledOnce();
      expect(warning).toHaveBeenCalledOnce();
    } finally {
      warning.mockRestore();
    }
  });

  it('keeps a normal successful WAV completion even if its data callback fails', async () => {
    const { recorder, node } = await makeRecorder();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const stopped = vi.fn();
      recorder.ondataavailable = () => { throw new Error('delivery failed'); };
      recorder.onstop = stopped;
      recorder.stop();
      node.port.onmessage({ data: { type: 'flushed' } });
      await vi.waitFor(() => expect(stopped).toHaveBeenCalledOnce());
      expect(warning).toHaveBeenCalledOnce();
    } finally {
      warning.mockRestore();
    }
  });
});
