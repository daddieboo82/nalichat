import { describe, expect, it, vi } from 'vitest';
import { sharedStudioCaptureConstraints, inspectSharedStudioCaptureSettings } from './sharedStudioCapture';
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
