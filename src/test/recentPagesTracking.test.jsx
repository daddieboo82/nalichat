// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useRecentPages } from '@/components/navigation/RecentlyVisited';

vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'artist' } }) }));

it('records mobile routes before opening More, removes stale shortcuts and keeps the latest four', () => {
  const titles = Object.fromEntries(['/', '/files', '/messages', '/record', '/meetings', '/explore'].map(path => [path, path]));
  sessionStorage.setItem('nali_recent_pages:artist', JSON.stringify(['/old-page', '/files']));
  const { result, rerender } = renderHook(path => useRecentPages(path, titles), { initialProps: '/' });
  for (const path of ['/messages', '/record', '/meetings', '/explore', '/record', '/']) rerender(path);
  expect(result.current.map(entry => entry.path)).toEqual(['/record', '/explore', '/meetings', '/messages']);
});
