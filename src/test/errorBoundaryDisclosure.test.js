// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('global error boundary disclosure', () => {
  it('shows a generic user-facing error instead of raw exception text', async () => {
    const source = await readFile('src/components/ErrorBoundary.jsx', 'utf8');
    expect(source).toContain('An unexpected error occurred. Please try again.');
    expect(source).not.toContain('this.state.error?.message ||');
  });
});
