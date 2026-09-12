// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WebhookTest from '@/pages/WebhookTest';

const authState = vi.hoisted(() => ({
  current: { user: null, isLoadingAuth: false, authError: null },
}));

const base44 = vi.hoisted(() => ({
  entities: {
    Subscription: {
      filter: vi.fn(),
    },
  },
}));

vi.mock('@/api/base44Client', () => ({ base44 }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => authState.current }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WebhookTest />
    </QueryClientProvider>,
  );
}

describe('WebhookTest access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    base44.entities.Subscription.filter.mockResolvedValue([]);
    authState.current = { user: null, isLoadingAuth: false, authError: null };
  });

  it('blocks non-admin users before loading subscription data', async () => {
    authState.current = { user: { id: 'u1', role: 'artist' }, isLoadingAuth: false, authError: null };
    renderPage();
    expect(await screen.findByText('Admins Only')).toBeTruthy();
    expect(base44.entities.Subscription.filter).not.toHaveBeenCalled();
  });

  it('allows admins to load the read-only diagnostics interface', async () => {
    authState.current = { user: { id: 'a1', role: 'admin' }, isLoadingAuth: false, authError: null };
    renderPage();
    expect(await screen.findByText('Backend Diagnostics')).toBeTruthy();
    expect(screen.queryByText('Add Mock Active Sub')).toBeNull();
    expect(screen.queryByText('Add Mock Pending Sub')).toBeNull();
    expect(screen.queryByText('Clear All')).toBeNull();
    expect(base44.entities.Subscription.filter).toHaveBeenCalledWith({ user_id: 'a1' });
  });
});
