// Keep the original audio codec when packaging a portable Studio session.
// Renaming MP3/FLAC/AAC bytes to .wav does not convert those bytes to WAV.
export const STUDIO_AUDIO_MIME_TYPES = Object.freeze({
  wav: "audio/wav",
  mp3: "audio/mpeg",
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  aiff: "audio/aiff",
});

const MIME_EXTENSIONS = Object.freeze({
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/vnd.wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "application/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/x-aac": "aac",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/aiff": "aiff",
  "audio/x-aiff": "aiff",
});

const EXTENSION_ALIASES = Object.freeze({ wave: "wav", aif: "aiff", oga: "ogg" });

export function studioAudioMimeForExtension(extension) {
  return STUDIO_AUDIO_MIME_TYPES[extension] || null;
}

export function studioAudioExtension({ mimeType = "", filename = "", sourceUrl = "" } = {}) {
  const type = String(mimeType).split(";")[0].trim().toLowerCase();
  if (MIME_EXTENSIONS[type]) return MIME_EXTENSIONS[type];

  // A remote file may return application/octet-stream. Preserve its extension
  // instead of incorrectly labeling its original bytes as PCM/WAV.
  for (const candidate of [filename, sourceUrl]) {
    if (typeof candidate !== "string") continue;
    const basename = candidate.split(/[?#]/)[0].split("/").pop() || "";
    const ext = basename.includes(".") ? basename.split(".").pop().toLowerCase() : "";
    const normalized = EXTENSION_ALIASES[ext] || ext;
    if (STUDIO_AUDIO_MIME_TYPES[normalized]) return normalized;
  }
  return null;
}
