import { describe, expect, it, vi } from 'vitest';
import {
  sharedGuideSchedule, startSharedSessionGuide,
  SHARED_GUIDE_BPM, SHARED_GUIDE_COUNT, SHARED_GUIDE_SECONDS,
} from './sharedSessionGuide';

describe('NaliChat shared-session count-in', () => {
  it('uses identical timing on every device at the default tempo', () => {
    expect(SHARED_GUIDE_BPM).toBe(120);
    expect(SHARED_GUIDE_COUNT).toBe(4);
    expect(SHARED_GUIDE_SECONDS).toBe(2);
    expect(sharedGuideSchedule().map(beat => beat.seconds)).toEqual([0, 0.5, 1, 1.5]);
    expect(sharedGuideSchedule()[0].strong).toBe(true);
    expect(() => sharedGuideSchedule({ bpm: 0 })).toThrow();
  });

  it('starts and cleans up a metronome from a real-like Web Audio context', async () => {
    const stop = vi.fn();
    const disconnect = vi.fn();
    const oscillator = () => ({
      type: '',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(), start: vi.fn(), stop, disconnect,
    });
    const envelope = () => ({
      gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(), disconnect,
    });
    const close = vi.fn().mockResolvedValue(undefined);
    class Context {
      state = 'running';
      currentTime = 1;
      destination = {};
      createOscillator = oscillator;
      createGain = envelope;
      async resume() {}
      close = close;
    }
    const guide = await startSharedSessionGuide({ AudioContextType: Context });
    expect(guide.durationSeconds).toBe(2);
    guide.stop();
    expect(stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('releases the context when audio playback is blocked', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    class Context {
      state = 'suspended';
      async resume() {}
      close = close;
    }
    await expect(startSharedSessionGuide({ AudioContextType: Context }))
      .rejects.toThrow(/blocked/);
    expect(close).toHaveBeenCalled();
  });
});
