// Shared client-side upload validation.
//
// Uploads previously went straight to Core.UploadFile with no type or size
// check, so a mistyped selection or an oversized file only failed after a long
// transfer (or not at all). These limits are a UX and abuse guard on the client;
// the backend remains the authority.

const MB = 1024 * 1024;

export const UPLOAD_LIMITS = {
  image: { maxBytes: 15 * MB, label: 'image' },
  audio: { maxBytes: 100 * MB, label: 'audio file' },
  video: { maxBytes: 200 * MB, label: 'video' },
  file: { maxBytes: 250 * MB, label: 'file' },
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/flac'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];

// Some browsers/OSes report an empty MIME type; fall back to the extension.
const EXT_KIND = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', avif: 'image', heic: 'image', heif: 'image',
  mp3: 'audio', wav: 'audio', ogg: 'audio', aac: 'audio', m4a: 'audio', flac: 'audio', weba: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', mkv: 'video',
};

export function detectKind(file) {
  const type = (file?.type || '').toLowerCase();
  if (IMAGE_TYPES.includes(type) || type.startsWith('image/')) return 'image';
  if (AUDIO_TYPES.includes(type) || type.startsWith('audio/')) return 'audio';
  if (VIDEO_TYPES.includes(type) || type.startsWith('video/')) return 'video';
  const ext = (file?.name || '').split('.').pop()?.toLowerCase();
  return EXT_KIND[ext] || 'file';
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
}

/**
 * Validate a File before upload.
 * @param {File} file
 * @param {{ accept?: 'image'|'audio'|'video'|'file', maxBytes?: number }} options
 * @returns {{ ok: boolean, error?: string, kind: string }}
 */
export function validateUpload(file, { accept, maxBytes } = {}) {
  if (!file) return { ok: false, error: 'No file selected.', kind: 'file' };
  const kind = detectKind(file);

  if (accept && kind !== accept) {
    return { ok: false, error: `That's not a valid ${UPLOAD_LIMITS[accept]?.label || accept}. Please choose a different file.`, kind };
  }

  if (file.size === 0) {
    return { ok: false, error: 'That file is empty.', kind };
  }

  const limit = maxBytes || UPLOAD_LIMITS[accept || kind]?.maxBytes || UPLOAD_LIMITS.file.maxBytes;
  if (file.size > limit) {
    return {
      ok: false,
      error: `That ${UPLOAD_LIMITS[kind]?.label || 'file'} is ${formatBytes(file.size)}. The limit is ${formatBytes(limit)}.`,
      kind,
    };
  }

  return { ok: true, kind };
}
