// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationBell from '@/components/notifications/NotificationBell';

const base44 = vi.hoisted(() => ({
  auth: { me: vi.fn() },
  entities: {
    Notification: {
      filter: vi.fn(),
      subscribe: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const push = vi.hoisted(() => ({
  registerServiceWorker: vi.fn(),
  requestPushPermission: vi.fn(),
  subscribeToRemotePush: vi.fn(),
  showPushNotification: vi.fn(),
  getPermissionStatus: vi.fn(),
}));

vi.mock('@/api/base44Client', () => ({ base44 }));
vi.mock('@/lib/pushNotifications', () => push);
vi.mock('@/hooks/use-sound', () => ({ sounds: { notification: vi.fn() } }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe('NotificationBell push permission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    base44.auth.me.mockResolvedValue({ id: 'u1' });
    base44.entities.Notification.filter.mockResolvedValue([]);
    base44.entities.Notification.subscribe.mockReturnValue(() => {});
    push.registerServiceWorker.mockResolvedValue({});
    push.requestPushPermission.mockResolvedValue(true);
    push.subscribeToRemotePush.mockResolvedValue({ subscribed: true });
    push.getPermissionStatus.mockReturnValue('default');
  });

  it('does not prompt for notification permission on mount', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    await waitFor(() => expect(base44.auth.me).toHaveBeenCalled());
    expect(push.registerServiceWorker).toHaveBeenCalled();
    expect(push.requestPushPermission).not.toHaveBeenCalled();
  });

  it('requests permission only after the user chooses Enable alerts', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Notifications/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enable alerts' }));

    await waitFor(() => {
      expect(push.requestPushPermission).toHaveBeenCalledTimes(1);
      expect(push.subscribeToRemotePush).toHaveBeenCalledTimes(1);
    });
  });
});
