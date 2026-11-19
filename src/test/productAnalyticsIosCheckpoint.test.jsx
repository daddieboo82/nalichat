// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ track: vi.fn(), create: vi.fn().mockResolvedValue({}), log: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: {
  analytics: { track: mocks.track },
  entities: { ActivationFunnel: { create: mocks.create } },
  appLogs: { logUserInApp: mocks.log },
} }));
import { initProductAnalytics } from '@/lib/productAnalytics';

let cleanup;
const setDevice = (userAgent, platform, maxTouchPoints) => {
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
  Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
};
const engagementRecords = (reason = 'heartbeat') => mocks.create.mock.calls.map(([record]) => record)
  .filter(record => record.event_name === 'product_session_engagement' && record.metadata.reason === reason);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
  sessionStorage.clear();
  localStorage.clear();
  mocks.track.mockReset();
  mocks.create.mockClear();
  mocks.log.mockClear();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); });

describe('first-party iOS session checkpoints', () => {
  it('persists one incremental checkpoint per 30 seconds of visible engagement without using broken iOS transport', () => {
    setDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'iPhone', 5);
    cleanup = initProductAnalytics();
    mocks.create.mockClear();
    vi.advanceTimersByTime(31_000);
    expect(engagementRecords()).toHaveLength(1);
    expect(engagementRecords()[0].metadata).toMatchObject({ reason: 'heartbeat', ios_checkpoint: true });
    expect(engagementRecords()[0].metadata.engaged_seconds).toBeGreaterThanOrEqual(30);
    expect(mocks.track).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(engagementRecords()).toHaveLength(2);
  });
  it('supports iPads identifying as touch-capable Macs', () => {
    setDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5);
    cleanup = initProductAnalytics();
    mocks.create.mockClear();
    vi.advanceTimersByTime(31_000);
    expect(engagementRecords()).toHaveLength(1);
    expect(mocks.track).not.toHaveBeenCalled();
  });
  it('does not add heartbeat entity writes on desktop browsers', () => {
    setDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0);
    cleanup = initProductAnalytics();
    mocks.create.mockClear();
    mocks.track.mockClear();
    vi.advanceTimersByTime(61_000);
    expect(engagementRecords()).toHaveLength(0);
    expect(mocks.track).toHaveBeenCalled();
  });
});

describe('early session checkpoint', () => {
  it('records five foreground seconds once and categorizes a desktop without tracking background time', () => {
    setDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0);
    cleanup = initProductAnalytics();
    vi.advanceTimersByTime(2_000);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(30_000);
    expect(engagementRecords('early_checkpoint')).toHaveLength(0);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(3_000);
    expect(engagementRecords('early_checkpoint')[0]?.metadata).toMatchObject({
      device_type: 'Desktop', landing_path: '/', engaged_seconds: 5,
    });
    vi.advanceTimersByTime(10_000);
    expect(engagementRecords('early_checkpoint')).toHaveLength(1);
  });
});
