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
