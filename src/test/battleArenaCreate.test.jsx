// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import LiveBattles from '@/pages/LiveBattles';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: { functions: { invoke } } }));

afterEach(() => {
  cleanup();
  invoke.mockReset();
  vi.unstubAllGlobals();
});

function ArenaDestination() {
  const location = useLocation();
  return <p>{location.pathname + location.search}</p>;
}

it('uploads a permitted track and opens the invitation step for the saved battle', async () => {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL() { return 'blob:battle-preview'; }
    static revokeObjectURL() {}
  });
  invoke.mockResolvedValue({ data: { success: true, battleId: 'battle_12345678' } });
  render(
    <MemoryRouter initialEntries={['/battles/new']}>
      <Routes>
        <Route path="/battles/new" element={<LiveBattles />} />
        <Route path="/battles" element={<ArenaDestination />} />
      </Routes>
    </MemoryRouter>,
  );
  const submit = screen.getByRole('button', { name: 'Save and invite an artist' });
  const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' });
  fireEvent.change(screen.getByLabelText('Battle name'), { target: { value: 'Friday rap battle' } });
  fireEvent.change(screen.getByLabelText(/Battle track/), { target: { files: [file] } });
  expect(submit.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: /permission to use/ }));
  fireEvent.click(submit);
  expect(await screen.findByText('/battles?draft=battle_12345678')).toBeTruthy();
  const [name, body] = invoke.mock.calls[0];
  expect(name).toBe('createBattleDraft');
  expect(body.get('rights_confirmed')).toBe('true');
  expect(body.get('file').name).toBe('track.mp3');
});
