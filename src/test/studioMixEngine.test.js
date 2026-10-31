import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/audioProcessing', () => ({
  connectMasterChain: vi.fn((context) => {
    const input = context.createGain();
    const volume = context.createGain();
    return { input, volume, reverbBus: context.createGain(), nodes: [input, volume] };
  }),
  connectTrackChain: vi.fn((context, source, track, { destination, gain } = {}) => {
    const trackGain = context.createGain();
    trackGain.gain.value = gain ?? 1;
    const panner = context.createStereoPanner();
    source.connect(trackGain);
    trackGain.connect(panner);
    panner.connect(destination);
    return { nodes: [trackGain, panner], trackGain, panner, output: panner, sendGain: null };
  }),
  trackGainValue: vi.fn(track => Number(track.volume ?? 100) / 100),
}));

import { connectMasterChain, connectTrackChain } from '@/lib/audioProcessing';
import { createMixEngine } from '@/lib/studioMixEngine';

const createdNodes = [];
const makeParam = (value = 1) => ({ value, setTargetAtTime: vi.fn() });
const makeNode = (kind = 'gain') => {
  const node = {
    kind,
    gain: makeParam(1),
    pan: kind === 'panner' ? makeParam(0) : undefined,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  createdNodes.push(node);
  return node;
};
let context;

class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 12;
    this.destination = makeNode('destination');
    this.createGain = vi.fn(() => makeNode('gain'));
    this.createStereoPanner = vi.fn(() => makeNode('panner'));
    this.createMediaElementSource = vi.fn(() => makeNode('source'));
    this.resume = vi.fn(() => Promise.resolve());
    this.close = vi.fn(() => Promise.resolve());
    context = this;
  }
}

const track = { id: 'vocal', volume: 80, pan: 50, effects: {}, send1: 0 };

describe('realtime Studio mix engine', () => {
  beforeEach(() => {
    context = null;
    createdNodes.length = 0;
    vi.clearAllMocks();
    globalThis.window = {
      AudioContext: FakeAudioContext,
      location: { href: 'https://studio.example/', origin: 'https://studio.example' },
    };
  });

  it('routes a media element through a channel strip and tracks its lifecycle', () => {
    const engine = createMixEngine();
    const element = { volume: 0.25 };

    expect(engine.attach('vocal', element, track)).toBe(true);
    expect(engine.isReady()).toBe(true);
    expect(engine.isRouted('vocal')).toBe(true);
    expect(element.volume).toBe(1);
    expect(engine.attach('vocal', element, track)).toBe(true);

    engine.detach('vocal');
    expect(engine.isRouted('vocal')).toBe(false);
    engine.dispose();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('updates clip gain and fade on separate gain stages', () => {
    const engine = createMixEngine();
    engine.attach('vocal', { volume: 1 }, track);
    const gainNodes = createdNodes.filter(node => node.kind === 'gain');
    const regionGain = gainNodes[3];
    const fadeGain = gainNodes[4];

    expect(engine.syncRegionGain('vocal', 0.5)).toBe(true);
    expect(engine.syncFade('vocal', 0.25)).toBe(true);
    expect(regionGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, 12, 0.01);
    expect(fadeGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.25, 12, 0.015);
    expect(engine.syncRegionGain('missing', 1)).toBe(false);
    expect(engine.syncFade('missing', 1)).toBe(false);
    engine.dispose();
  });

  it('updates channel gain and pan without rebuilding the strip', () => {
    const engine = createMixEngine();
    engine.attach('vocal', { volume: 1 }, track);
    const initialBuilds = connectTrackChain.mock.calls.length;

    expect(engine.syncTrack('vocal', { ...track, volume: 60, pan: 100 })).toBe(true);
    expect(connectTrackChain).toHaveBeenCalledTimes(initialBuilds);
    const panner = createdNodes.find(node => node.kind === 'panner');
    expect(panner.pan.setTargetAtTime).toHaveBeenCalledWith(1, 12, 0.01);
    engine.dispose();
  });

  it('rebuilds channel and master routing when insert structure changes', () => {
    const engine = createMixEngine();
    engine.attach('vocal', { volume: 1 }, track);
    const channelBuilds = connectTrackChain.mock.calls.length;
    const masterBuilds = connectMasterChain.mock.calls.length;

    engine.syncTrack('vocal', { ...track, effects: { compressor: { enabled: true } } });
    expect(connectTrackChain).toHaveBeenCalledTimes(channelBuilds + 1);

    engine.syncMaster({ masterVolume: 70, masterFx: { limiter: { enabled: true } } });
    expect(connectMasterChain).toHaveBeenCalledTimes(masterBuilds + 1);
    expect(connectTrackChain).toHaveBeenCalledTimes(channelBuilds + 2);
    engine.dispose();
  });
});
