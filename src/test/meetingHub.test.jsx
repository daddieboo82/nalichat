// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MeetingHub from '@/pages/MeetingHub';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: { functions: { invoke } } }));

afterEach(() => {
  cleanup();
  invoke.mockReset();
  vi.unstubAllGlobals();
});

function Destination() {
  const location = useLocation();
  return <div>{location.pathname + location.search}<span data-testid="new-meeting-invite">{location.state?.newMeetingInvite || ''}</span></div>;
}

function renderHub() {
  invoke.mockResolvedValue({ data: { rooms: [] } });
  render(<MemoryRouter initialEntries={['/meetings']}>
    <Routes>
      <Route path="/meetings" element={<MeetingHub />} />
      <Route path="/meetings/:roomId" element={<Destination />} />
    </Routes>
  </MemoryRouter>);
}

describe('Meeting Hub', () => {
  it('creates an immediate video meeting with only a name', async () => {
    renderHub();
    invoke.mockImplementation(async (_name, body) => body.action === 'list'
      ? { data: { rooms: [] } }
      : { data: { room: { id: 'room_123456' }, inviteCode: 'a'.repeat(43) } });
    fireEvent.change(screen.getByLabelText('Meeting name'), { target: { value: 'Team check-in' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create meeting' }));
    expect(await screen.findByRole('link', { name: 'Open room' })).toBeTruthy();
    const [, payload] = invoke.mock.calls.find(([, body]) => body.action === 'create');
    expect(payload).toMatchObject({ title: 'Team check-in', kind: 'business' });
    expect(Math.abs(Date.now() - Date.parse(payload.startsAt))).toBeLessThan(10_000);
  });

  it('opens a newly created room immediately on mobile with its invite link', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    renderHub();
    invoke.mockImplementation(async (_name, body) => body.action === 'list'
      ? { data: { rooms: [] } }
      : { data: { room: { id: 'room_123456' }, inviteCode: 'b'.repeat(43) } });
    fireEvent.change(screen.getByLabelText('Meeting name'), { target: { value: 'Mobile check-in' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create meeting' }));
    expect((await screen.findByTestId('new-meeting-invite')).textContent).toContain('/meetings/room_123456?invite=');
  });

  it('rejects other domains and opens a valid invitation on the current app', async () => {
    renderHub();
    const path = '/meetings/room_123456?invite=' + 'a'.repeat(43);
    const input = screen.getByLabelText('Invite link', { exact: true });
    const join = screen.getByRole('button', { name: 'Join meeting' });
    fireEvent.change(input, { target: { value: 'https://example.com' + path } });
    fireEvent.click(join);
    expect(screen.getByRole('alert').textContent).toMatch(/Paste the full NaliChat/);
    fireEvent.change(input, { target: { value: 'https://nalichat.org' + path } });
    fireEvent.click(join);
    expect(await screen.findByText(path)).toBeTruthy();
  });
});
