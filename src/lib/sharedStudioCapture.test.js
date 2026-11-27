import { describe, expect, it, vi } from 'vitest';
import { sharedStudioCaptureConstraints, inspectSharedStudioCaptureSettings, openStudioMicrophone, studioMicrophoneErrorMessage } from './sharedStudioCapture';
import { analyzeSharedStudioRecordedBlob } from './sharedStudioCaptureQuality';

describe('remote Studio microphone capture', () => {
  it('requests an unprocessed mono mic with a preferred 48 kHz rate', () => {
    expect(sharedStudioCaptureConstraints.audio).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48000 },
    });
  });

  it('uses the device built-in mic without an external interface', async () => {
    const stream = { getTracks: () => [] };
    const devices = { getUserMedia: vi.fn().mockResolvedValue(stream) };
    expect(await openStudioMicrophone(devices)).toBe(stream);
    expect(devices.getUserMedia).toHaveBeenCalledWith(sharedStudioCaptureConstraints);
  });

  it('falls back for browsers that reject optional sample-rate constraints', async () => {
    const stream = { getTracks: () => [] };
    const reject = Object.assign(new Error('unsupported sample rate'), { name: 'OverconstrainedError' });
    const devices = { getUserMedia: vi.fn().mockRejectedValueOnce(reject).mockResolvedValue(stream) };
    expect(await openStudioMicrophone(devices)).toBe(stream);
    expect(devices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(devices.getUserMedia.mock.calls[1][0]).toEqual({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  });

  it('does not retry or bypass denied microphone permission', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const devices = { getUserMedia: vi.fn().mockRejectedValue(denied) };
    await expect(openStudioMicrophone(devices)).rejects.toBe(denied);
    expect(devices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['NotAllowedError', /access is blocked/],
    ['NotFoundError', /no microphone was detected/i],
    ['NotReadableError', /found a microphone but could not start it/],
  ])('explains a microphone failure with %s', (name, expected) => {
    expect(studioMicrophoneErrorMessage({ name })).toMatch(expected);
  });

  it('explains when microphone capture is unsupported', async () => {
    const error = await openStudioMicrophone({}).catch(error => error);
    expect(studioMicrophoneErrorMessage(error)).toMatch(/browser that supports recording/);
  });

  it('warns if a mobile browser overrides the mic processing request', () => {
    expect(inspectSharedStudioCaptureSettings({
      echoCancellation: true, noiseSuppression: false, autoGainControl: false, sampleRate: 44100,
    })).toMatchObject({ processingEnabled: true, actualSampleRate: 44100 });
    expect(inspectSharedStudioCaptureSettings({
      echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    }).warning).toBeNull();
  });

  it('classifies a decoded clipped microphone track without changing its audio', async () => {
    const pcm = new Float32Array(2000).fill(.12);
    pcm.fill(1, 0, 50);
    const close = vi.fn().mockResolvedValue(undefined);
    const audioContextFactory = () => ({
      decodeAudioData: async () => ({
        length: pcm.length, numberOfChannels: 1, sampleRate: 48000,
        getChannelData: () => pcm,
      }),
      close,
    });
    const result = await analyzeSharedStudioRecordedBlob(
      new Blob([new Uint8Array(4096)], { type: 'audio/webm' }), { audioContextFactory },
    );
    expect(result.status).toBe('clipping');
    expect(pcm[0]).toBe(1);
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not block a take on platforms that cannot decode its codec', async () => {
    const result = await analyzeSharedStudioRecordedBlob(
      new Blob([new Uint8Array(512)], { type: 'audio/mp4' }),
      { audioContextFactory: () => ({ decodeAudioData: async () => { throw new Error('Unsupported'); }, close: async () => {} }) },
    );
    expect(result).toBeNull();
  });
});
