// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WebhookTest from '@/pages/WebhookTest';

const base44 = vi.hoisted(() => ({
  auth: { me: vi.fn() },
  entities: {
    Subscription: {
      filter: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/api/base44Client', () => ({ base44 }));
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
  });

  it('blocks non-admin users before loading subscription data', async () => {
    base44.auth.me.mockResolvedValue({ id: 'u1', role: 'artist' });
    renderPage();
    expect(await screen.findByText('Admins Only')).toBeTruthy();
    expect(base44.entities.Subscription.filter).not.toHaveBeenCalled();
  });

  it('allows admins to load the testing interface', async () => {
    base44.auth.me.mockResolvedValue({ id: 'a1', role: 'admin' });
    renderPage();
    expect(await screen.findByText('Backend Testing Interface')).toBeTruthy();
    expect(base44.entities.Subscription.filter).toHaveBeenCalledWith({ user_id: 'a1' });
  });
});
