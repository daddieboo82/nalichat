import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectMasterChain: vi.fn(),
  connectTrackChain: vi.fn(),
  trackGainValue: vi.fn(() => 0.75),
  trackPanValue: vi.fn(track => ((Number(track?.pan ?? 50) - 50) / 50)),
  automatedTrackState: vi.fn(track => track),
  getClipRegionGainAtTime: vi.fn(() => 0.5),
}));

vi.mock('@/lib/audioProcessing', () => ({
  connectMasterChain: mocks.connectMasterChain,
  connectTrackChain: mocks.connectTrackChain,
  trackGainValue: mocks.trackGainValue,
  trackPanValue: mocks.trackPanValue,
  automatedTrackState: mocks.automatedTrackState,
  getClipRegionGainAtTime: mocks.getClipRegionGainAtTime,
}));

import { createMixEngine } from '@/lib/studioMixEngine';

const makeParam = () => ({
  value: 0,
  setTargetAtTime: vi.fn(),
});

class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
    FakeAudioContext.lastInstance = this;
  }
  createMediaElementSource() {
    this.mediaSource = { connect: vi.fn(), disconnect: vi.fn() };
    return this.mediaSource;
  }
  createGain() {
    return { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn() };
  }
  close() { return Promise.resolve(); }
  resume() { return Promise.resolve(); }
}

describe('Studio mixer pan persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('routes the media source through a region envelope before the channel strip', () => {
    mocks.connectMasterChain.mockImplementation(() => ({
      nodes: [],
      input: {},
      reverbBus: {},
      delayBus: {},
      cueBus: {},
      volume: { gain: makeParam() },
    }));
    mocks.connectTrackChain.mockImplementation(() => ({
      nodes: [],
      trackGain: { gain: makeParam() },
      sendGains: [],
    }));
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });

    const engine = createMixEngine();
    const audioElement = { volume: 1 };
    const track = { id: 'track-region', pan: 50, effects: {} };
    expect(engine.attach('track-region', audioElement, track)).toBe(true);
    const regionGain = mocks.connectTrackChain.mock.calls[0][1];
    expect(regionGain).toBeDefined();
    expect(regionGain.gain.value).toBe(1);

    expect(engine.syncClipRegion('track-region', track, {
      timelineStart: 0, sourceStart: 0, sourceEnd: 4, gainDb: 0,
    }, 1)).toBe(true);
    expect(regionGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, 0, 0.008);

    const mediaSource = FakeAudioContext.lastInstance.mediaSource;
    expect(mediaSource.connect).toHaveBeenCalledTimes(1);
    engine.syncTrack('track-region', { ...track, effects: { eq: { enabled: true } } });
    expect(mediaSource.disconnect).not.toHaveBeenCalled();
    expect(mediaSource.connect).toHaveBeenCalledTimes(1);
    engine.dispose();
    expect(mediaSource.disconnect).toHaveBeenCalledTimes(1);
  });

  it('restores the latest automated pan after a channel-strip rebuild', () => {
    const panners = [];
    mocks.connectMasterChain.mockImplementation(() => ({
      nodes: [],
      input: {},
      reverbBus: {},
      delayBus: {},
      cueBus: {},
      volume: { gain: makeParam() },
    }));
    mocks.connectTrackChain.mockImplementation(() => {
      const panner = { pan: makeParam(), disconnect: vi.fn() };
      panners.push(panner);
      return {
        nodes: [panner],
        trackGain: { gain: makeParam() },
        sendGains: [],
      };
    });
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });

    const engine = createMixEngine();
    const audioElement = { volume: 1 };
    const initialTrack = { id: 'track-1', pan: 25, effects: { eq: { enabled: true } } };

    expect(engine.attach('track-1', audioElement, initialTrack)).toBe(true);
    expect(panners[0].pan.value).toBeCloseTo(-0.5);

    const automatedTrack = { ...initialTrack, pan: 80, effects: { compressor: { enabled: true } } };
    expect(engine.syncTrack('track-1', automatedTrack)).toBe(true);
    expect(panners).toHaveLength(2);
    expect(panners[1].pan.value).toBeCloseTo(0.6);

    engine.dispose();
  });
});
