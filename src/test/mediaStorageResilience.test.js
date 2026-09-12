// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('media storage resilience', () => {
  it('keeps sound storage safe without clearing the persisted preference at import time', async () => {
    const source = await readText('src/hooks/use-sound.js');
    expect(source).toContain('function safeStorageGet(key)');
    expect(source).toContain('function safeStorageRemove(key)');
    expect(source).not.toContain('safeStorageRemove("nali_sounds_off");\n}');
    expect(source).not.toContain('localStorage.removeItem("nali_sounds_off");\n}');
  });

  it('uses storage-safe audio device preferences and handles missing mediaDevices', async () => {
    const source = await readText('src/hooks/useAudioDevices.js');
    expect(source).toContain("input: safeGet('audioInputDevice', 'default')");
    expect(source).toContain("navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange)");
    expect(source).toContain("throw new Error('Media device enumeration is not supported in this browser')");
  });

  it('handles unsupported recording formats and microphone startup failures', async () => {
    const source = await readText('src/pages/Record.jsx');
    expect(source).toContain('function getSupportedRecordingMimeType()');
    expect(source).toContain('MediaRecorder.isTypeSupported?.(type)');
    expect(source).toContain('if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")');
    expect(source).toContain('error?.name === "NotAllowedError"');
    expect(source).toContain('const recordingMimeType = recorder.mimeType || mimeType || "audio/webm"');
    expect(source).toContain('const extension = recordingExtension(rec.blob.type)');
  });

  it('uses a supported MIME type in the practice recorder and cleans up failed starts', async () => {
    const source = await readText('src/components/record/RecordingGuide.jsx');
    expect(source).toContain('function getPracticeMimeType()');
    expect(source).toContain("MediaRecorder.isTypeSupported?.(type)");
    expect(source).toContain("typeof MediaRecorder === 'undefined'");
    expect(source).toContain("const recordingMimeType = rec.mimeType || mimeType || 'audio/webm'");
    expect(source).toContain('stream?.getTracks().forEach(t => t.stop())');
  });

  it('preserves collaborative recording MIME type and rejects empty captures', async () => {
    const source = await readText('src/components/messages/ChatSessionViewer.jsx');
    expect(source).toContain('const recordingMimeType = recorder.mimeType || mimeType || "audio/webm"');
    expect(source).toContain('new Blob(chunksRef.current, { type: recordingMimeType })');
    expect(source).toContain('if (blob.size === 0)');
    expect(source).toContain('const extension = recordingExtension(recordingMimeType)');
  });

  it('preserves Studio recorder MIME type and closes waveform decode contexts', async () => {
    const source = await readText('src/pages/Studio.jsx');
    expect(source).toContain("mediaRecorderRef.current?.mimeType");
    expect(source).toContain("audioChunksRef.current.find((chunk) => chunk?.type)?.type");
    expect(source).toContain("if (blob.size === 0)");
    expect(source).toContain("void waveformAudioCtx.close().catch(() => {})");
  });

  it('cleans up AudioSuite contexts and abandoned processed blob URLs', async () => {
    const source = await readText('src/components/studio/AudioSuiteDialog.jsx');
    expect(source).toContain("let audioCtx = null;");
    expect(source).toContain("let handedOffUrl = false;");
    expect(source).toContain("URL.revokeObjectURL(newUrl)");
    expect(source).toContain("await audioCtx.close().catch(() => {})");
  });

  it('rejects failed audio fetches and always closes decoder contexts', async () => {
    const source = await readText('src/lib/audioProcessing.js');
    expect(source).toContain('if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`)');
    expect(source).toContain('if (!AudioContextClass) throw new Error("Web Audio is not supported")');
    expect(source).toContain('await ctx.close().catch(() => {})');
  });

  it('consolidates the trimmed Studio buffer instead of re-exporting the original track', async () => {
    const source = await readText('src/pages/Studio.jsx');
    expect(source).toContain('audioBufferToWav(trimmedBuffer)');
    expect(source).toContain('if (!response.ok) throw new Error(`Failed to load ${track.name || "clip"}: ${response.status}`)');
    expect(source).toContain('destinationChannel.set(sourceChannel.subarray(startSample, endSample));');
    expect(source).toContain('await audioCtx.close().catch(() => {})');
  });

  it('keeps resumable transfers working when localStorage is unavailable', async () => {
    const source = await readText('src/lib/resumableUpload.js');
    expect(source).toContain('try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}');
    expect(source).toContain('try { localStorage.setItem(STORAGE_KEY_DL, String(received)); } catch {}');
    expect(source).toContain('try { localStorage.removeItem(STORAGE_KEY_DL); } catch {}');
  });
});
