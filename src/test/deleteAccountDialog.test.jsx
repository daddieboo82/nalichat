// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeleteAccountDialog from '@/components/settings/DeleteAccountDialog';

const base44 = vi.hoisted(() => ({
  auth: { logout: vi.fn() },
  functions: { invoke: vi.fn() },
}));

vi.mock('@/api/base44Client', () => ({ base44 }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('DeleteAccountDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    base44.functions.invoke.mockResolvedValue({ data: { success: true } });
    base44.auth.logout.mockResolvedValue(undefined);
  });

  it('requires explicit DELETE confirmation and uses the server deletion function', async () => {
    render(<DeleteAccountDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    const deleteForever = await screen.findByRole('button', { name: 'Delete Forever' });
    expect(deleteForever).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Type DELETE'), { target: { value: 'DELETE' } });
    expect(deleteForever).not.toBeDisabled();
    fireEvent.click(deleteForever);

    await waitFor(() => {
      expect(base44.functions.invoke).toHaveBeenCalledWith('deleteMyAccount', { confirmation: 'DELETE' });
      expect(base44.auth.logout).toHaveBeenCalled();
    });
  });
});
