import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./audioProcessing', () => ({
  audioBufferToWav: vi.fn(() => new Blob(['wav'], { type: 'audio/wav' })),
  bufferToWaveform: vi.fn(() => [0.3, 0.6]),
}));

import { polishVocalLocally } from './localVocalPolish';

const makeBuffer = (samples, sampleRate = 24000) => ({
  length: samples.length,
  duration: samples.length / sampleRate,
  sampleRate,
  numberOfChannels: 1,
  getChannelData: () => samples,
});

let output;
class FakeAudioContext {
  async decodeAudioData() { return makeBuffer(new Float32Array(24000).fill(0.2)); }
  async close() {}
}
class FakeOfflineAudioContext {
  constructor(channels, length, rate) {
    this.destination = {};
    this.channels = channels;
    this.length = length;
    this.rate = rate;
  }
  createBufferSource() {
    return { connect: vi.fn(), start: vi.fn(), set buffer(value) { this.input = value; } };
  }
  createBiquadFilter() {
    return { connect: vi.fn(), frequency: { value: 0 }, Q: { value: 0 } };
  }
  createDynamicsCompressor() {
    return { connect: vi.fn(), threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} };
  }
  async startRendering() { return output; }
}

describe('VoxShift local vocal polish', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { AudioContext: FakeAudioContext, OfflineAudioContext: FakeOfflineAudioContext });
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext);
    output = makeBuffer(new Float32Array(24000).fill(0.2));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders without invoking any backend', async () => {
    const result = await polishVocalLocally(new Blob(['voice']));
    expect(result.duration).toBe(1);
    expect(result.waveform).toEqual([0.3, 0.6]);
    expect(result.blob.type).toBe('audio/wav');
  });

  it('protects output peaks from clipping', async () => {
    const samples = new Float32Array(24000).fill(1.2);
    output = makeBuffer(samples);
    await polishVocalLocally(new Blob(['voice']));
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.931);
  });

  it('does not boost silence', async () => {
    const samples = new Float32Array(24000);
    output = makeBuffer(samples);
    await polishVocalLocally(new Blob(['voice']));
    expect(samples.some(sample => sample !== 0)).toBe(false);
  });

  it('honors cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(polishVocalLocally(new Blob(['voice']), controller.signal)).rejects.toThrow();
  });
});
