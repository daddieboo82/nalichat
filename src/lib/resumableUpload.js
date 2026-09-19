import * as tus from "tus-js-client";
import { base44 } from "@/api/base44Client";

const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

function assertTransferFile(file) {
  if (!(file instanceof File) || !file.name || file.size <= 0) {
    throw new Error("The selected file is empty or invalid.");
  }
}

/**
 * Upload through Nali Transfer. There is intentionally no NaliChat total-size
 * ceiling here; the underlying storage provider/account capacity still applies.
 *
 * The returned Promise exposes controller.pause/resume/cancel synchronously so
 * callers can control a transfer while still awaiting its completion.
 */
export function resumableUpload(file, onProgress) {
  assertTransferFile(file);

  let upload;
  let cancelled = false;
  let paused = false;

  const promise = (async () => {
    const authorization = await base44.functions.invoke("createResumableTransferUpload", {
      file_name: file.name,
      file_size: file.size,
      content_type: file.type || "application/octet-stream",
    });
    const auth = authorization?.data || authorization;
    if (!auth?.token || !auth?.tusEndpoint || !auth?.bucket || !auth?.objectPath) {
      throw new Error(auth?.error || "Could not authorize resumable transfer.");
    }
    if (cancelled) throw new Error("Transfer cancelled.");

    return await new Promise((resolve, reject) => {
      upload = new tus.Upload(file, {
        endpoint: auth.tusEndpoint,
        chunkSize: TUS_CHUNK_SIZE,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: { "x-signature": auth.token },
        metadata: {
          bucketName: auth.bucket,
          objectName: auth.objectPath,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        onProgress(bytesUploaded, bytesTotal) {
          onProgress?.(bytesTotal ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
        },
        onError(error) {
          reject(error);
        },
        async onSuccess() {
          try {
            const finalized = await base44.functions.invoke("finalizeResumableTransferUpload", {
              objectPath: auth.objectPath,
            });
            const result = finalized?.data || finalized;
            if (
              result?.success !== true ||
              result?.action !== "finalize_resumable_transfer_upload" ||
              result?.userId !== auth.userId ||
              typeof result?.file_url !== "string"
            ) {
              throw new Error(result?.error || "Transfer verification failed.");
            }
            onProgress?.(100);
            resolve({
              file_url: result.file_url,
              bucket: result.bucket,
              objectPath: result.objectPath,
              fileName: file.name,
              fileSize: result.fileSize,
              contentType: file.type || "application/octet-stream",
            });
          } catch (error) {
            reject(error);
          }
        },
      });

      upload.findPreviousUploads()
        .then((previous) => {
          if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
          if (cancelled) return reject(new Error("Transfer cancelled."));
          if (!paused) upload.start();
        })
        .catch(reject);
    });
  })();

  promise.controller = {
    pause: () => {
      paused = true;
      return upload?.abort(false);
    },
    resume: () => {
      if (cancelled) return;
      paused = false;
      return upload?.start();
    },
    cancel: () => {
      cancelled = true;
      paused = false;
      return upload?.abort(true);
    },
  };
  return promise;
}

export async function resumableDownload(urlOrProvider, fileName, onProgress) {
  const getUrl = typeof urlOrProvider === "function" ? urlOrProvider : async () => urlOrProvider;
  const storageKey = `nali-transfer-download:${fileName || "download"}`;
  const supportsFilePicker = typeof window.showSaveFilePicker === "function";
  let fileHandle = null;
  let writable = null;
  let offset = 0;
  const chunks = [];

  if (supportsFilePicker) {
    fileHandle = await window.showSaveFilePicker({ suggestedName: fileName || "download" });
    const existing = await fileHandle.getFile();
    offset = existing.size;
    writable = await fileHandle.createWritable({ keepExistingData: true });
    if (offset > 0) await writable.seek(offset);
  } else {
    // Fallback browsers can retry within the current session. We deliberately
    // do not claim cross-restart byte persistence without a writable file handle.
    const savedOffset = Number(sessionStorage.getItem(storageKey) || 0);
    offset = Number.isFinite(savedOffset) && savedOffset > 0 ? savedOffset : 0;
  }

  // Range requests let an interrupted transfer continue from the last confirmed
  // byte. A URL provider may mint a fresh signed URL before each retry.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const url = await getUrl();
    const headers = offset > 0 ? { Range: `bytes=${offset}-` } : {};
    let response;
    try {
      response = await fetch(url, { headers });
    } catch (error) {
      if (attempt === 5) throw error;
      continue;
    }

    if (offset > 0 && response.status !== 206) {
      // The origin cannot continue this partial transfer. Restart safely.
      offset = 0;
      chunks.length = 0;
      sessionStorage.removeItem(storageKey);
      if (writable) {
        await writable.truncate(0);
        await writable.seek(0);
      }
      continue;
    }
    if (!response.ok && response.status !== 206) throw new Error("Download request failed.");

    const contentRange = response.headers.get("content-range");
    const rangeTotal = contentRange?.match(/\/(\d+)$/)?.[1];
    const responseLength = Number(response.headers.get("content-length") || 0);
    const total = Number(rangeTotal || (responseLength ? offset + responseLength : 0));
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Streaming download is unavailable.");

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (writable) {
          await writable.write(value);
        } else {
          chunks.push(value);
          sessionStorage.setItem(storageKey, String(offset + value.length));
        }
        offset += value.length;
        if (total > 0) onProgress?.(Math.min(99, Math.round((offset / total) * 100)));
      }
      sessionStorage.removeItem(storageKey);
      if (writable) {
        await writable.close();
        writable = null;
      } else {
        const dlUrl = URL.createObjectURL(new Blob(chunks, {
          type: response.headers.get("content-type") || "application/octet-stream",
        }));
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = fileName || "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(dlUrl);
      }
      onProgress?.(100);
      return;
    } catch (error) {
      if (attempt === 5) throw error;
    }
  }

  throw new Error("Download could not be resumed.");
}
