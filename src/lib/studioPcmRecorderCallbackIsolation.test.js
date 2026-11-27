import { describe, expect, it, vi } from 'vitest';
import { createLosslessStudioRecorder } from './studioPcmRecorder';

async function makeRecorder({ close = () => Promise.resolve() } = {}) {
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
    close() { return close(); }
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
  it('rejects restarting a recorder while its Stop flush is still pending', async () => {
    const { recorder, node } = await makeRecorder();
    const stopped = vi.fn();
    recorder.onstop = stopped;
    recorder.stop();
    expect(() => recorder.start()).toThrow('Recorder has already stopped');
    node.port.onmessage({ data: { type: 'flushed' } });
    await vi.waitFor(() => expect(stopped).toHaveBeenCalledOnce());
    expect(() => recorder.start()).toThrow('Recorder has already stopped');
  });

  it('rejects restarting after an unexpected failure or disposal', async () => {
    const failed = await makeRecorder();
    failed.node.port.onmessageerror();
    expect(() => failed.recorder.start()).toThrow('Recorder has already stopped');
    const disposed = await makeRecorder();
    disposed.recorder.dispose();
    expect(() => disposed.recorder.start()).toThrow('Recorder has already stopped');
  });


  it('delivers the captured WAV and Stop even when AudioContext.close never settles', async () => {
    const close = vi.fn(() => new Promise(() => {}));
    const { recorder, node } = await makeRecorder({ close });
    const events = [];
    let recovered;
    recorder.ondataavailable = ({ data }) => { recovered = data; events.push('data'); };
    recorder.onstop = () => events.push('stop');
    recorder.stop();
    node.port.onmessage({ data: { type: 'flushed' } });
    await vi.waitFor(() => expect(events).toEqual(['data', 'stop']));
    expect(recovered.type).toBe('audio/wav');
    expect(close).toHaveBeenCalledOnce();
    expect(recorder.state).toBe('inactive');
  });

  it('delivers recording completion when AudioContext.close throws synchronously', async () => {
    const close = vi.fn(() => { throw new Error('Device lost'); });
    const { recorder, node } = await makeRecorder({ close });
    const stopped = vi.fn();
    recorder.onstop = stopped;
    recorder.stop();
    node.port.onmessage({ data: { type: 'flushed' } });
    await vi.waitFor(() => expect(stopped).toHaveBeenCalledOnce());
    expect(close).toHaveBeenCalledOnce();
  });

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

  it('finalizes buffered audio if the worklet rejects the flush command synchronously', async () => {
    const { recorder, node } = await makeRecorder();
    const events = [];
    let recovered;
    recorder.ondataavailable = event => { recovered = event.data; events.push('data'); };
    recorder.onerror = ({ error }) => { expect(error.message).toBe('MessagePort closed'); events.push('error'); };
    recorder.onstop = () => events.push('stop');
    node.port.postMessage = () => { throw new Error('MessagePort closed'); };
    expect(() => recorder.stop()).not.toThrow();
    await vi.waitFor(() => expect(events).toEqual(['data', 'error', 'stop']));
    const bytes = new DataView(await recovered.arrayBuffer());
    expect(bytes.getUint32(40, true)).toBe(6);
    expect(recorder.state).toBe('inactive');
    node.port.onmessageerror();
    expect(events).toEqual(['data', 'error', 'stop']);
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
