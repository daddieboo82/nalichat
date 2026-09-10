// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CoverArt from '@/pages/CoverArt';

const mockBase44 = vi.hoisted(() => ({
  auth: {
    me: vi.fn(),
  },
  entities: {
    ArtPost: {
      filter: vi.fn(),
      update: vi.fn(),
    },
  },
  integrations: {
    Core: {
      UploadFile: vi.fn(),
    },
  },
  functions: {
    invoke: vi.fn(),
  },
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@/api/base44Client', () => ({ base44: mockBase44 }));
vi.mock('sonner', () => ({ toast: mockToast }));

const renderWithProviders = (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('CoverArt explicit badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBase44.auth.me.mockResolvedValue({ id: 'user-1', display_name: 'Fresh User', full_name: 'Fresh User' });
    mockBase44.entities.ArtPost.filter.mockResolvedValue([
      {
        id: 'track-explicit',
        title: 'Night Drive',
        genre: 'Hip Hop',
        medium: 'original',
        image_url: 'https://cdn.example.com/night-drive.jpg',
        is_explicit: true,
      },
      {
        id: 'track-clean',
        title: 'Sunrise',
        genre: 'Soul',
        medium: 'original',
        image_url: 'https://cdn.example.com/sunrise.jpg',
      },
      {
        id: 'track-false',
        title: 'Daylight',
        genre: 'R&B',
        medium: 'original',
        image_url: 'https://cdn.example.com/daylight.jpg',
        is_explicit: false,
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the parental advisory badge only for explicit songs', async () => {
    renderWithProviders(<CoverArt />);

    fireEvent.click(await screen.findByText('Night Drive'));

    await waitFor(() => {
      expect(screen.getByTestId('parental-advisory-badge')).toBeTruthy();
      expect(screen.getByText('Parental')).toBeTruthy();
      expect(screen.getByText('Advisory')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Sunrise'));

    await waitFor(() => {
      expect(screen.queryByTestId('parental-advisory-badge')).toBeNull();
    });

    fireEvent.click(screen.getByText('Daylight'));

    await waitFor(() => {
      expect(screen.queryByTestId('parental-advisory-badge')).toBeNull();
    });
  });
});
