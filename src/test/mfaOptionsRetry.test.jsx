// @vitest-environment jsdom
import React from 'react';
import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Mfa from '@/pages/Mfa';
import { loadSignInOptions } from '@/lib/authMfaFlow';

vi.mock('@/lib/authMfaFlow', () => ({
  resumeMfa: async () => null,
  loadSignInOptions: vi.fn(),
}));

it('recovers configured sign-in methods after a temporary loading failure', async () => {
  loadSignInOptions.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
    auth_config: { enable_username_password: true, enable_google_login: false },
  });
  render(<Mfa />);
  const retry = await screen.findByRole('button', { name: 'Try again' });
  expect(screen.queryByText('Continue with Google')).toBeNull();
  fireEvent.click(retry);
  await screen.findByLabelText('Email');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(loadSignInOptions).toHaveBeenCalledTimes(2);
});
