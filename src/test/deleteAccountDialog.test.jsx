// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeleteAccountDialog from '@/components/settings/DeleteAccountDialog';

const base44 = vi.hoisted(() => ({
  auth: { logout: vi.fn() },
  functions: { invoke: vi.fn() },
}));
const mockUser = { id: 'user-123' };

vi.mock('@/api/base44Client', () => ({ base44 }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('DeleteAccountDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    base44.functions.invoke.mockResolvedValue({
      data: { success: true, action: 'delete_my_account', userId: mockUser.id, deleted: true },
    });
    base44.auth.logout.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('requires explicit DELETE confirmation and uses the server deletion function', async () => {
    render(<DeleteAccountDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    const deleteForever = await screen.findByRole('button', { name: 'Delete Forever' });
    expect(deleteForever.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('Type DELETE'), { target: { value: 'DELETE' } });
    expect(deleteForever.disabled).toBe(false);
    fireEvent.click(deleteForever);

    await waitFor(() => {
      expect(base44.functions.invoke).toHaveBeenCalledWith('deleteMyAccount', { confirmation: 'DELETE' });
      expect(base44.auth.logout).toHaveBeenCalled();
    });
  });

  it('does not log out for a mismatched deletion response', async () => {
    base44.functions.invoke.mockResolvedValue({
      data: { success: true, action: 'delete_my_account', userId: 'other-user', deleted: true },
    });
    render(<DeleteAccountDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    fireEvent.change(await screen.findByPlaceholderText('Type DELETE'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Forever' }));

    await waitFor(() => {
      expect(base44.functions.invoke).toHaveBeenCalled();
      expect(base44.auth.logout).not.toHaveBeenCalled();
    });
  });
});
