// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ track: vi.fn(), create: vi.fn().mockResolvedValue({}), log: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: {
  analytics: { track: mock.track },
  entities: { ActivationFunnel: { create: mock.create } },
  appLogs: { logUserInApp: mock.log },
} }));
import { initProductAnalytics, trackProductEvent } from '@/lib/productAnalytics';
let cleanup;
beforeEach(() => {
  Object.defineProperty(navigator, 'webdriver', { configurable: true, value: true });
  mock.track.mockClear(); mock.create.mockClear(); mock.log.mockClear();
});
afterEach(() => {
  cleanup?.(); cleanup = undefined;
  Object.defineProperty(navigator, 'webdriver', { configurable: true, value: false });
});
describe('automated browser analytics exclusion', () => {
  it('does not create synthetic visits or signup events', () => {
    cleanup = initProductAnalytics();
    trackProductEvent('homepage_demo_click', { source: 'public_landing_hero' });
    trackProductEvent('registration_view', { source: 'register' });
    expect(mock.track).not.toHaveBeenCalled();
    expect(mock.create).not.toHaveBeenCalled();
    expect(mock.log).not.toHaveBeenCalled();
  });
  it('continues first-party analytics when webdriver is false', () => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: false });
    cleanup = initProductAnalytics();
    trackProductEvent('homepage_demo_click', { source: 'public_landing_hero' });
    expect(mock.track).toHaveBeenCalled();
    expect(mock.create).toHaveBeenCalled();
  });
});
