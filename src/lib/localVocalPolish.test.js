import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./audioProcessing', () => ({
  audioBufferToWav: vi.fn(() => new Blob(['wav'], { type: 'audio/wav' })),
  bufferToWaveform: vi.fn(() => [0.3, 0.6]),
}));

import { audioBufferToWav } from './audioProcessing';
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
  createBuffer(_channels, length, rate) {
    const samples = new Float32Array(length);
    return { ...makeBuffer(samples, rate), copyToChannel: data => samples.set(data.subarray(0, length)) };
  }
  async startRendering() { return output; }
}

describe('VoxShift local vocal polish', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { AudioContext: FakeAudioContext, OfflineAudioContext: FakeOfflineAudioContext });
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext);
    output = makeBuffer(new Float32Array(24144).fill(0.2));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders without invoking any backend', async () => {
    const result = await polishVocalLocally(new Blob(['voice']));
    expect(result.duration).toBe(1);
    expect(result.waveform).toEqual([0.3, 0.6]);
    expect(result.blob.type).toBe('audio/wav');
  });

  it('protects output peaks from clipping', async () => {
    const samples = new Float32Array(24144).fill(1.2);
    output = makeBuffer(samples);
    await polishVocalLocally(new Blob(['voice']));
    expect(Math.max(...audioBufferToWav.mock.lastCall[0].getChannelData(0))).toBeLessThanOrEqual(0.931);
  });

  it('does not boost silence', async () => {
    const samples = new Float32Array(24144);
    output = makeBuffer(samples);
    await polishVocalLocally(new Blob(['voice']));
    expect(audioBufferToWav.mock.lastCall[0].getChannelData(0).every(sample => sample === 0)).toBe(true);
  });

  it('aligns compressor output and preserves the final source sample', async () => {
    const samples = new Float32Array(24144);
    samples[144] = 0.2;
    samples[24143] = -0.3;
    output = makeBuffer(samples);
    const result = await polishVocalLocally(new Blob(['voice']));
    const rendered = audioBufferToWav.mock.lastCall[0].getChannelData(0);
    expect(result.duration).toBe(1);
    expect(rendered[0]).toBeGreaterThan(0);
    expect(rendered.at(-1)).toBeLessThan(0);
  });

  it('accepts a one-second take rounded down by one decoded frame', async () => {
    const decode = vi.spyOn(FakeAudioContext.prototype, 'decodeAudioData');
    try {
      decode.mockResolvedValueOnce(makeBuffer(new Float32Array(23999)));
      output = makeBuffer(new Float32Array(23999 + 144));
      const result = await polishVocalLocally(new Blob(['voice']));
      expect(result.duration).toBeCloseTo(23999 / 24000);
      decode.mockResolvedValueOnce(makeBuffer(new Float32Array(23998)));
      await expect(polishVocalLocally(new Blob(['voice']))).rejects.toThrow('1–60 seconds');
    } finally {
      decode.mockRestore();
    }
  });

  it('honors cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(polishVocalLocally(new Blob(['voice']), controller.signal)).rejects.toThrow();
  });
});
