// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboard from '@/pages/AdminDashboard';

const authState = vi.hoisted(() => ({
  current: { user: null, isLoadingAuth: false, authError: null },
}));

const base44 = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
}));

vi.mock('@/api/base44Client', () => ({ base44 }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => authState.current }));
vi.mock('@/components/admin/NaliMaintenancePanel', () => ({
  default: () => <div>Maintenance</div>,
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminDashboard />
    </QueryClientProvider>,
  );
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.current = { user: null, isLoadingAuth: false, authError: null };
  });

  it('renders the aggregate stats returned by the admin function', async () => {
    authState.current = { user: { id: 'admin-1', role: 'admin' }, isLoadingAuth: false, authError: null };
    base44.functions.invoke.mockResolvedValue({
      data: {
        stats: {
          totalUsers: 42,
          totalSubscriptions: 18,
          activeSubscriptions: 12,
          trialSubscriptions: 3,
          pendingSubscriptions: 2,
          canceledSubscriptions: 1,
          premiumSubscriptions: 7,
          premiumPlusSubscriptions: 5,
        },
      },
    });

    renderDashboard();

    expect(await screen.findByText('Business Dashboard')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
      expect(screen.getByText('12')).toBeTruthy();
      expect(screen.getByText('7')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
    });
    expect(base44.functions.invoke).toHaveBeenCalledWith('getAdminDashboardStats', {});
  });

  it('does not request platform stats for a non-admin user', async () => {
    authState.current = { user: { id: 'user-1', role: 'artist' }, isLoadingAuth: false, authError: null };

    renderDashboard();

    expect(await screen.findByText('Admins Only')).toBeTruthy();
    expect(base44.functions.invoke).not.toHaveBeenCalled();
  });
});
