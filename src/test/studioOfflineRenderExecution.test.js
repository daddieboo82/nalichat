import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMixToBuffer } from '../lib/audioProcessing';
import { groupStudioClipLanes } from '../lib/studioClipLanes';

const starts = [];
const offlineContexts = [];
const makeNode = () => ({
  connect() {},
  disconnect() {},
  gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} },
  pan: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} },
  frequency: { value: 0 }, delayTime: { value: 0 }, normalize: false,
});
const makeBuffer = (seconds, sampleRate = 10) => ({
  duration: seconds, sampleRate, length: Math.round(seconds * sampleRate),
  numberOfChannels: 2, getChannelData: () => new Float32Array(Math.round(seconds * sampleRate)),
});
class MockAudioContext {
  constructor() { this.state = 'running'; }
  decodeAudioData() { return Promise.resolve(makeBuffer(10)); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
class MockOfflineContext {
  constructor(channels, length, rate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = rate;
    this.destination = makeNode();
    offlineContexts.push(this);
  }
  createGain() { return makeNode(); }
  createDelay() { return makeNode(); }
  createBiquadFilter() { return makeNode(); }
  createConvolver() { return makeNode(); }
  createStereoPanner() { return makeNode(); }
  createBuffer(channels, length, rate) { return makeBuffer(length / rate, rate); }
  createBufferSource() { return { ...makeNode(), start(...args) { starts.push(args); } }; }
  startRendering() { return Promise.resolve(makeBuffer(this.length / this.sampleRate, this.sampleRate)); }
}
beforeEach(() => {
  starts.length = 0; offlineContexts.length = 0;
  vi.stubGlobal('window', { AudioContext: MockAudioContext });
  vi.stubGlobal('OfflineAudioContext', MockOfflineContext);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) })));
});
afterEach(() => vi.unstubAllGlobals());

describe('Studio offline renderer executed with a simulated Web Audio engine', () => {
  it('renders two split regions without including trimmed-out source audio', async () => {
    const tracks = [
      { id: 1, splitFrom: 1, audioUrl: 'source.wav', startTime: 2, duration: 3, clipStart: 2 },
      { id: 2, splitFrom: 1, audioUrl: 'source.wav', startTime: 5, duration: 4, clipStart: 5 },
    ];
    const result = await renderMixToBuffer(tracks, { sampleRate: 10 });
    expect(result.duration).toBe(9);
    expect(offlineContexts.at(-1).length).toBe(90);
    expect(starts).toEqual([[2, 2, 3], [5, 5, 4]]);
  });

  it('one visible split lane still exports both source regions', async () => {
    const tracks = [
      { id: 1, splitFrom: 1, audioUrl: 'source.wav', startTime: 0, duration: 3, clipStart: 0 },
      { id: 2, splitFrom: 1, audioUrl: 'source.wav', startTime: 3, duration: 7, clipStart: 3 },
    ];
    const [lane] = groupStudioClipLanes(tracks);
    expect(groupStudioClipLanes(tracks)).toHaveLength(1);
    await renderMixToBuffer(lane.clips, { sampleRate: 10 });
    expect(starts).toEqual([[0, 0, 3], [3, 3, 7]]);
  });

  it('muted solo regions are excluded from the offline bounce', async () => {
    const result = await renderMixToBuffer([
      { audioUrl: 'source.wav', startTime: 0, duration: 3, solo: true, muted: true },
      { audioUrl: 'source.wav', startTime: 1, duration: 4, solo: true, muted: false },
    ], { sampleRate: 10 });
    expect(result.duration).toBe(5);
    expect(starts).toEqual([[1, 0, 4]]);
  });

  it('refuses to render clips fully trimmed beyond the source boundary', async () => {
    const result = await renderMixToBuffer([
      { audioUrl: 'source.wav', startTime: 0, clipStart: 11, duration: 2 },
    ], { sampleRate: 10 });
    expect(result).toBeNull();
    expect(starts).toHaveLength(0);
  });
});
