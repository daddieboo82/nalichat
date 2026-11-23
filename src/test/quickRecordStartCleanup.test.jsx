// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Record from '@/pages/Record';

vi.mock('@/api/base44Client', () => ({ base44: {} }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));
vi.mock('@/lib/secureUpload', () => ({ secureUploadFile: vi.fn() }));
vi.mock('@/hooks/useAudioDevices', () => ({
  useAudioDevices: () => ({ devices: { input: [] }, selectedDevices: { input: 'default' }, selectDevice: vi.fn() }),
}));
vi.mock('@/components/record/MicCheckPanel', () => ({ default: () => null }));
vi.mock('@/components/record/RecordingGuide', () => ({ default: () => null }));
vi.mock('@/components/record/RecordingCountdown', () => ({
  default: ({ onComplete }) => <button onClick={onComplete}>Skip countdown</button>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('starts microphone capture on the first tap on mobile, with optional count-in', async () => {
  let grantMicrophone;
  const getUserMedia = vi.fn(() => new Promise(resolve => { grantMicrophone = resolve; }));
  const stop = vi.fn();
  vi.stubGlobal('matchMedia', vi.fn(query => ({
    matches: query === '(max-width: 767px)',
    media: query,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia } }));
  vi.stubGlobal('MediaRecorder', vi.fn());

  const { unmount } = render(<Record />);
  expect(screen.getByRole('checkbox', { name: '3-second count-in' }).checked).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
  expect(getUserMedia).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Skip countdown' })).toBeNull();
  unmount();
  await act(async () => grantMicrophone({ getTracks: () => [{ stop }] }));
  expect(stop).toHaveBeenCalledOnce();
});

it('releases a microphone that resolves after leaving Quick Record', async () => {
  let grantMicrophone;
  const getUserMedia = vi.fn(() => new Promise(resolve => { grantMicrophone = resolve; }));
  const stop = vi.fn();
  const MediaRecorder = vi.fn();
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia } }));
  vi.stubGlobal('MediaRecorder', MediaRecorder);

  const { unmount } = render(<Record />);
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
  fireEvent.click(screen.getByRole('button', { name: 'Skip countdown' }));
  expect(await screen.findByText('Opening microphone…')).toBeTruthy();
  unmount();
  await act(async () => grantMicrophone({ getTracks: () => [{ stop }] }));

  expect(stop).toHaveBeenCalledOnce();
  expect(MediaRecorder).not.toHaveBeenCalled();
});
