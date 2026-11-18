import { describe, expect, it, vi } from 'vitest';
import {
  selectStudioRecorderOptions, createStudioMediaRecorder, studioRecordingExtension,
  STUDIO_RECORDING_TARGET_BITRATE,
} from './studioRecorderCodec';

describe('portable high-quality Studio recording', () => {
  it('selects actual lossless codecs before lossy options when supported', () => {
    function Recorder() {}
    Recorder.isTypeSupported = type => type === 'audio/wav' || type === 'audio/webm;codecs=opus';
    const selected = selectStudioRecorderOptions(Recorder);
    expect(selected.lossless).toBe(true);
    expect(selected.options).toEqual({ mimeType: 'audio/wav' });
  });
  it('uses high bitrate Opus when lossless recording is unavailable', () => {
    function Recorder() {}
    Recorder.isTypeSupported = type => type === 'audio/webm;codecs=opus';
    const selected = selectStudioRecorderOptions(Recorder);
    expect(selected.lossless).toBe(false);
    expect(selected.options).toEqual({
      mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: STUDIO_RECORDING_TARGET_BITRATE,
    });
  });
  it('supports iPhone AAC/MP4 without assuming WAV', () => {
    function Recorder() {}
    Recorder.isTypeSupported = type => type === 'audio/mp4';
    const selected = selectStudioRecorderOptions(Recorder);
    expect(selected.options.mimeType).toBe('audio/mp4');
    expect(selected.lossless).toBe(false);
    expect(studioRecordingExtension('audio/mp4')).toBe('m4a');
  });
  it('retries without bitrate when a browser rejects recording options', () => {
    const stream = { id: 'mic' };
    const recorder = vi.fn(function(streamArg, options) {
      if (options?.audioBitsPerSecond) throw new Error('Unsupported bitrate');
      this.stream = streamArg;
      this.mimeType = options?.mimeType || 'audio/webm';
    });
    recorder.isTypeSupported = type => type === 'audio/webm;codecs=opus';
    const result = createStudioMediaRecorder(stream, recorder);
    expect(result.fellBack).toBe(true);
    expect(result.recorder.mimeType).toBe('audio/webm;codecs=opus');
    expect(recorder).toHaveBeenCalledTimes(2);
  });
  it('uses browser default when its declared MIME codec is rejected too', () => {
    const Recorder = vi.fn(function(_stream, options) {
      if (options) throw new Error('Unsupported');
      this.mimeType = 'audio/webm';
    });
    Recorder.isTypeSupported = type => type === 'audio/webm;codecs=opus';
    const result = createStudioMediaRecorder({}, Recorder);
    expect(result.lossless).toBe(false);
    expect(result.codec).toBeNull();
    expect(Recorder).toHaveBeenCalledTimes(3);
  });
  it('matches extensions to the encoded container', () => {
    expect(studioRecordingExtension('audio/wav')).toBe('wav');
    expect(studioRecordingExtension('audio/flac')).toBe('flac');
    expect(studioRecordingExtension('audio/ogg;codecs=opus')).toBe('ogg');
  });
});
