// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatSessionViewer from '@/components/messages/ChatSessionViewer';

const base44 = vi.hoisted(() => ({
  entities: { Track: { filter: vi.fn() } },
  functions: { invoke: vi.fn() },
}));
const upload = vi.hoisted(() => vi.fn());
const validate = vi.hoisted(() => vi.fn(() => ({ ok: true })));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/api/base44Client', () => ({ base44 }));
vi.mock('@/lib/secureUpload', () => ({ secureUploadFile: upload }));
vi.mock('@/lib/uploadValidation', () => ({ validateUpload: validate }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));
vi.mock('lucide-react', () => ({
  Mic: () => <span aria-hidden="true" />,
  Square: () => <span aria-hidden="true" />,
  Loader2: () => <span aria-hidden="true" />,
}));
vi.mock('@/components/studio/MultiTrackEditor', () => ({
  default: ({ tracks }) => <div data-testid="track-count">{tracks.length}</div>,
}));

class FakeMediaRecorder {
  static isTypeSupported(type) {
    return type === 'audio/webm;codecs=opus';
  }
  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'audio/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
  }
  start() {
    this.state = 'recording';
  }
  requestData() {
    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) });
  }
  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

describe('ChatSessionViewer browser recording flow', () => {
  const streamTrack = { stop: vi.fn() };
  const stream = { getTracks: () => [streamTrack] };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.MediaRecorder = FakeMediaRecorder;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    base44.entities.Track.filter.mockResolvedValue([]);
    upload.mockResolvedValue({ file_url: 'https://cdn.example/recorded.webm' });
    base44.functions.invoke.mockResolvedValue({
      data: {
        success: true,
        action: 'create_collaborative_track',
        userId: 'user-1',
        parentId: 'message-1',
        trackId: 'track-1',
        track: {
          id: 'track-1',
          project_id: 'message-1',
          uploaded_by: 'user-1',
          file_url: 'https://cdn.example/recorded.webm',
        },
      },
    });
  });

  afterEach(() => cleanup());

  it('captures microphone data, uploads it, creates the track, and updates the editor', async () => {
    render(
      <ChatSessionViewer
        message={{ id: 'message-1', text: 'Test Live Session' }}
        currentUser={{ id: 'user-1', full_name: 'Test User' }}
      />,
    );

    await waitFor(() => expect(base44.entities.Track.filter).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /record track/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^stop$/i })).toBeTruthy());
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));

    await waitFor(() => expect(upload).toHaveBeenCalled());
    const uploadedFile = upload.mock.calls[0][0].file;
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.type).toBe('audio/webm;codecs=opus');
    expect(uploadedFile.size).toBeGreaterThan(0);
    expect(validate).toHaveBeenCalledWith(uploadedFile);
    expect(base44.functions.invoke).toHaveBeenCalledWith('createCollaborativeTrack', expect.objectContaining({
      project_id: 'message-1',
      file_url: 'https://cdn.example/recorded.webm',
      type: 'vocal',
    }));
    await waitFor(() => expect(screen.getByTestId('track-count')).toHaveTextContent('1'));
    expect(streamTrack.stop).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
