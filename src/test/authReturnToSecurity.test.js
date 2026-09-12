// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { safeReturnTo } from '@/lib/authReturnTo';

describe('safeReturnTo', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('strips every app-bootstrap configuration/token parameter from returnTo', () => {
    const target = '/messages?id=abc'
      + '&access_token=secret'
      + '&clear_access_token=true'
      + '&app_id=attacker'
      + '&app_base_url=https%3A%2F%2Fevil.example'
      + '&backend_url=https%3A%2F%2Fevil.example'
      + '&functions_version=evil'
      + '&from_url=https%3A%2F%2Fevil.example';
    window.history.replaceState({}, '', '/login?returnTo=' + encodeURIComponent(target));

    const resolved = safeReturnTo();

    expect(resolved).toBe('/messages?id=abc');
    expect(resolved).not.toContain('backend_url');
    expect(resolved).not.toContain('access_token');
    expect(resolved).not.toContain('app_id');
  });

  it('rejects cross-origin and protocol-relative return targets', () => {
    window.history.replaceState({}, '', '/login?returnTo=' + encodeURIComponent('https://evil.example/path'));
    expect(safeReturnTo()).toBe('/');

    window.history.replaceState({}, '', '/login?returnTo=' + encodeURIComponent('//evil.example/path'));
    expect(safeReturnTo()).toBe('/');
  });
});
