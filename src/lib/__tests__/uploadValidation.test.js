import { describe, it, expect } from 'vitest';
import { validateUpload, detectKind, formatBytes, UPLOAD_LIMITS } from '@/lib/uploadValidation';

const MB = 1024 * 1024;

/** Build a fake File with a controllable size (allocating real large files is wasteful). */
const mkFile = (name, type, size) => {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('detectKind', () => {
  it('classifies by MIME type', () => {
    expect(detectKind(mkFile('a.jpg', 'image/jpeg', 10))).toBe('image');
    expect(detectKind(mkFile('a.mp3', 'audio/mpeg', 10))).toBe('audio');
    expect(detectKind(mkFile('a.mp4', 'video/mp4', 10))).toBe('video');
    expect(detectKind(mkFile('a.pdf', 'application/pdf', 10))).toBe('file');
  });

  it('falls back to the extension when the browser reports an empty MIME type', () => {
    // Mobile browsers frequently hand back "" for recorded audio.
    expect(detectKind(mkFile('voice.m4a', '', 10))).toBe('audio');
    expect(detectKind(mkFile('clip.mov', '', 10))).toBe('video');
    expect(detectKind(mkFile('photo.HEIC', '', 10))).toBe('image');
    expect(detectKind(mkFile('unknown.xyz', '', 10))).toBe('file');
  });
});

describe('validateUpload', () => {
  it('accepts files within the per-kind limit', () => {
    expect(validateUpload(mkFile('a.jpg', 'image/jpeg', 5 * MB)).ok).toBe(true);
    expect(validateUpload(mkFile('a.mp3', 'audio/mpeg', 50 * MB)).ok).toBe(true);
  });

  it('rejects oversized files, naming both the size and the limit', () => {
    const result = validateUpload(mkFile('a.jpg', 'image/jpeg', 20 * MB));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('20 MB');
    expect(result.error).toContain('15 MB');
  });

  it('enforces a different ceiling per kind', () => {
    // 50 MB is fine for audio but far over the image limit.
    expect(validateUpload(mkFile('a.mp3', 'audio/mpeg', 50 * MB)).ok).toBe(true);
    expect(validateUpload(mkFile('a.jpg', 'image/jpeg', 50 * MB)).ok).toBe(false);
    expect(UPLOAD_LIMITS.audio.maxBytes).toBeGreaterThan(UPLOAD_LIMITS.image.maxBytes);
  });

  it('rejects a kind mismatch when accept is specified', () => {
    expect(validateUpload(mkFile('a.pdf', 'application/pdf', 10), { accept: 'image' }).ok).toBe(false);
    expect(validateUpload(mkFile('a.png', 'image/png', 10), { accept: 'image' }).ok).toBe(true);
  });

  it('rejects empty and missing files rather than uploading nothing', () => {
    expect(validateUpload(mkFile('a.jpg', 'image/jpeg', 0)).ok).toBe(false);
    expect(validateUpload(null).ok).toBe(false);
  });

  it('honours an explicit maxBytes override', () => {
    expect(validateUpload(mkFile('a.jpg', 'image/jpeg', 2 * MB), { maxBytes: MB }).ok).toBe(false);
  });
});

describe('formatBytes', () => {
  it('renders human-readable sizes', () => {
    expect(formatBytes(500 * 1024)).toBe('500 KB');
    expect(formatBytes(5 * MB)).toBe('5.0 MB');
    expect(formatBytes(200 * MB)).toBe('200 MB');
  });

  it('does not produce NaN for junk input', () => {
    expect(formatBytes(0)).toBe('0 MB');
    expect(formatBytes(-5)).toBe('0 MB');
    expect(formatBytes(undefined)).toBe('0 MB');
  });
});
