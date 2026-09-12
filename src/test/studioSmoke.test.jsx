// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Studio from '@/pages/Studio';

const mockBase44 = vi.hoisted(() => ({
  entities: {
    Project: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/api/base44Client', () => ({ base44: mockBase44 }));
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', display_name: 'Fresh User', onboarding_completed: true },
    isLoadingAuth: false,
  }),
}));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPro: false }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/use-performance', () => ({ usePerformance: () => ({ isLowEnd: true }) }));
vi.mock('@/hooks/useStudioPresence', () => ({ useStudioPresence: () => ({ peers: [], setActivity: vi.fn() }) }));
vi.mock('@/hooks/use-sound', () => ({
  sounds: { click: vi.fn(), success: vi.fn(), notification: vi.fn(), nav: vi.fn() },
}));
vi.mock('@/lib/audioProcessing', () => ({
  separateStems: vi.fn(),
  generateMelody: vi.fn(),
  renderMixToWav: vi.fn(),
  renderMixToMp3: vi.fn(),
}));
vi.mock('@/lib/studioMixEngine', () => ({
  createMixEngine: () => ({ destroy: vi.fn(), dispose: vi.fn(), syncMaster: vi.fn() }),
  needsCrossOrigin: vi.fn(() => false),
}));
vi.mock('@/lib/instruments', () => ({
  renderInstrumentPhrase: vi.fn(),
  isSynthesizable: vi.fn(() => true),
  getInstrument: vi.fn(() => ({ name: 'Piano' })),
}));

describe('studio entry smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockBase44.entities.Project.get.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the studio welcome screen for a newly onboarded user without crashing', async () => {
    render(
      <MemoryRouter>
        <Studio />
      </MemoryRouter>
    );

    expect(await screen.findByText('Welcome to Studio')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create New Project/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Load Demo Project/i })).toBeTruthy();
  });
});
