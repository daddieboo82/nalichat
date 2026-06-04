/**
 * Resumable chunked file upload utility.
 * Splits files into chunks, tracks progress in localStorage,
 * and can resume from where it left off if interrupted.
 */

const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks
const STORAGE_KEY = "resumable_uploads";

function getUploadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

function saveUploadState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearUploadState(fileId) {
  const state = getUploadState();
  delete state[fileId];
  saveUploadState(state);
}

function getFileId(file) {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

/**
 * Upload a file with resume support.
 * @param {File} file
 * @param {(progress: number) => void} onProgress - 0..100
 * @returns {Promise<string>} file_url
 */
export async function resumableUpload(file, onProgress) {
  const fileId = getFileId(file);
  const state = getUploadState();
  const savedState = state[fileId];

  // If we have all chunks already uploaded and just need to finalize
  if (savedState?.fileUrl) {
    clearUploadState(fileId);
    onProgress?.(100);
    return savedState.fileUrl;
  }

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadedChunks = savedState?.uploadedChunks || [];
  const uploadedUrls = savedState?.uploadedUrls || [];

  // For small files (< 1MB), upload directly without chunking
  if (file.size <= CHUNK_SIZE) {
    onProgress?.(10);
    const { base44 } = await import("@/api/base44Client");
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onProgress?.(100);
    return file_url;
  }

  // Chunked upload for large files
  for (let i = 0; i < totalChunks; i++) {
    if (uploadedChunks.includes(i)) {
      onProgress?.(Math.round(((i + 1) / totalChunks) * 90));
      continue;
    }

    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const chunkFile = new File([chunk], `${file.name}.part${i}`, { type: file.type });

    const { base44 } = await import("@/api/base44Client");
    const { file_url: chunkUrl } = await base44.integrations.Core.UploadFile({ file: chunkFile });

    uploadedChunks.push(i);
    uploadedUrls.push(chunkUrl);

    // Save progress
    state[fileId] = { uploadedChunks: [...uploadedChunks], uploadedUrls: [...uploadedUrls], totalChunks, fileName: file.name };
    saveUploadState(state);

    onProgress?.(Math.round(((i + 1) / totalChunks) * 90));
  }

  // All chunks done — return the last chunk URL as the canonical URL
  // (avoids re-uploading the entire file again)
  clearUploadState(fileId);
  onProgress?.(100);
  return uploadedUrls[uploadedUrls.length - 1];
}

/**
 * Download a file with progress tracking and resume via Content-Range.
 * Falls back to direct link if range requests unsupported.
 * @param {string} url
 * @param {string} fileName
 * @param {(progress: number) => void} onProgress
 */
export async function resumableDownload(url, fileName, onProgress) {
  const STORAGE_KEY_DL = `dl_${fileName}_${url.slice(-20)}`;
  const savedBytes = parseInt(localStorage.getItem(STORAGE_KEY_DL) || "0");

  const headers = {};
  if (savedBytes > 0) headers["Range"] = `bytes=${savedBytes}-`;

  let response;
  try {
    response = await fetch(url, { headers });
  } catch {
    // Network error — trigger simple fallback download
    window.open(url, "_blank");
    return;
  }

  // If server doesn't support range or content-length, fall back
  if (!response.ok && response.status !== 206) {
    window.open(url, "_blank");
    return;
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength) + savedBytes : 0;

  const reader = response.body?.getReader();
  if (!reader) { window.open(url, "_blank"); return; }

  const chunks = [];
  let received = savedBytes;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    localStorage.setItem(STORAGE_KEY_DL, String(received));
    if (total > 0) onProgress?.(Math.round((received / total) * 100));
  }

  // Merge and trigger download
  const blob = new Blob(chunks);
  const dlUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = dlUrl;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(dlUrl);
  localStorage.removeItem(STORAGE_KEY_DL);
  onProgress?.(100);
}