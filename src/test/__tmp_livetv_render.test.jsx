// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LiveTV from '@/pages/LiveTV';

describe('LiveTV first render', () => {
  it('renders the page shell', () => {
    render(
      <MemoryRouter>
        <LiveTV />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'NaliVision' })).toBeTruthy();
    expect(screen.getByText(/Choose Free TV or import an authorized M3U playlist/i)).toBeTruthy();
  });
});