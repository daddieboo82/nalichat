/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Download from '@/pages/Download';

describe('Download page home navigation', () => {
  it('shows an obvious Home link back to the root route', () => {
    render(
      <MemoryRouter initialEntries={['/download']}>
        <Download />
      </MemoryRouter>
    );

    const home = screen.getByRole('link', { name: 'Back to Home' });
    expect(home.getAttribute('href')).toBe('/');
    expect(screen.getByText('Home')).toBeTruthy();
  });
});
