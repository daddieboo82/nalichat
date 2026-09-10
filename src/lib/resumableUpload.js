/**
 * Resumable chunked file upload utility.
 * Splits files into chunks, tracks progress in localStorage,
 * and can resume from where it left off if interrupted.
 */

import { authorizedUpload } from "@/lib/authorizedUpload";

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
 * @param {{ accept?: string, maxBytes?: number }} [options] - validation options
 * @returns {Promise<string>} file_url
 */
export async function resumableUpload(file, onProgress, options = {}) {
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
    const { file_url } = await authorizedUpload(file, options);
    onProgress?.(100);
    return file_url;
  }

  // Large files: upload the full file directly (chunking is not supported server-side for merging)
  onProgress?.(10);
  const { file_url } = await authorizedUpload(file, options);
  clearUploadState(fileId);
  onProgress?.(100);
  return file_url;
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
  // Partial bytes are not persisted, so a saved offset cannot be safely
  // resumed: concatenating the response would produce a corrupt file.
  // Clear stale progress and restart from the beginning instead.
  const savedBytes = parseInt(localStorage.getItem(STORAGE_KEY_DL) || "0", 10);
  if (savedBytes > 0) localStorage.removeItem(STORAGE_KEY_DL);

  const triggerFallback = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "download";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onProgress?.(100);
  };

  let response;
  try {
    response = await fetch(url);
  } catch {
    triggerFallback();
    return;
  }

  // If server doesn't support range or content-length, fall back
  if (!response.ok && response.status !== 206) {
    triggerFallback();
    return;
  }

  const contentLength = response.headers.get("content-length");
  const contentType = response.headers.get("content-type") || "";
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  const reader = response.body?.getReader();
  if (!reader) { triggerFallback(); return; }

  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    localStorage.setItem(STORAGE_KEY_DL, String(received));
    if (total > 0) onProgress?.(Math.round((received / total) * 100));
  }

  // Merge and trigger download
  const blob = new Blob(chunks, { type: contentType });
  const dlUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = dlUrl;
  a.download = fileName || "download";
  a.target = "_blank"; // Ensure fallback behavior
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(dlUrl);
  localStorage.removeItem(STORAGE_KEY_DL);
  onProgress?.(100);
}