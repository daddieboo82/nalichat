// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MicrophoneInputPicker from '@/components/audio/MicrophoneInputPicker';

let originalMediaDevices;
beforeEach(() => {
  localStorage.clear();
  originalMediaDevices = navigator.mediaDevices;
});
afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices });
  localStorage.clear();
});

function setMediaDevices(value) {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value });
}
const input = (deviceId, label) => ({ kind: 'audioinput', deviceId, label });
const getPicker = () => screen.getByRole('combobox', { name: 'Microphone input' });

describe('microphone picker lifecycle', () => {
  it('ignores late outdated scans and keeps the newest attached mic options', async () => {
    let finishFirst;
    const first = new Promise(resolve => { finishFirst = resolve; });
    const enumerateDevices = vi.fn().mockReturnValueOnce(first).mockResolvedValue([input('usb', 'USB Mic')]);
    const listeners = new Map();
    setMediaDevices({
      enumerateDevices,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
    });
    render(<MicrophoneInputPicker />);
    await act(async () => { listeners.get('devicechange')(); });
    expect(await screen.findByRole('option', { name: 'USB Mic' })).toBeTruthy();
    await act(async () => { finishFirst([input('old', 'Old Mic')]); });
    expect(screen.queryByRole('option', { name: 'Old Mic' })).toBeNull();
  });

  it('does not open a second permission prompt and releases the stream even after closing', async () => {
    let grant;
    const stop = vi.fn();
    const getUserMedia = vi.fn(() => new Promise(resolve => { grant = resolve; }));
    setMediaDevices({
      enumerateDevices: vi.fn().mockResolvedValue([]),
      getUserMedia,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    const view = render(<MicrophoneInputPicker />);
    const button = screen.getByRole('button', { name: /allow microphone & refresh/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(getUserMedia).toHaveBeenCalledOnce();
    view.unmount();
    await act(async () => { grant({ getTracks: () => [{ stop }] }); });
    expect(stop).toHaveBeenCalledOnce();
  });

  it('retains the unavailable saved mic identity rather than falsely displaying system default', async () => {
    localStorage.setItem('audioInputDevice', 'unplugged');
    setMediaDevices({
      enumerateDevices: vi.fn().mockResolvedValue([input('available', 'Wired Mic')]),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    render(<MicrophoneInputPicker />);
    await waitFor(() => expect(getPicker().value).toBe('unplugged'));
    expect(screen.getByRole('option', { name: 'Saved microphone (currently unavailable)' })).toBeTruthy();
    expect(screen.getByText(/not currently listed/i)).toBeTruthy();
  });
});
