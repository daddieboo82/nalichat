// Standalone device-local PCM spool. Not wired into the live recorder yet.
// The caller owns a unique session ID and must explicitly remove its data.
const DB_NAME = 'nalichat-pcm-spool-v1';
const STORE = 'chunks';
export async function openStudioPcmSpool(sessionId, { indexedDB = globalThis.indexedDB, maxPendingBytes = 4 * 1024 * 1024 } = {}) {
  if (typeof sessionId !== 'string' || !/^[a-z0-9_-]{16,128}$/i.test(sessionId)) throw new Error('Invalid PCM session ID');
  if (!indexedDB?.open) throw new Error('PCM storage unavailable');
  if (!Number.isSafeInteger(maxPendingBytes) || maxPendingBytes < 8192) throw new Error('Invalid PCM queue limit');
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, {keyPath:['sessionId','sequence']}); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('PCM storage open failed'));
    req.onblocked = () => reject(new Error('PCM storage blocked'));
  });
  function transaction(mode, action) {
    return new Promise((resolve,reject) => {
      const tx = db.transaction(STORE, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('PCM storage transaction failed'));
      try {
        const request = action(tx.objectStore(STORE));
        if (request) request.onsuccess = () => { result = request.result; };
      } catch (error) { try { tx.abort(); } catch {} reject(error); }
    });
  }
  let sequence = 0, pendingBytes = 0, totalBytes = 0, failure = null, closed = false;
  let tail = Promise.resolve();
  return {
    get pendingBytes() { return pendingBytes; },
    get totalBytes() { return totalBytes; },
    append(buffer) {
      if (closed || failure) return Promise.reject(failure || new Error('PCM spool closed'));
      if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.byteLength % 2) return Promise.reject(new Error('Invalid PCM chunk'));
      if (pendingBytes + buffer.byteLength > maxPendingBytes) return Promise.reject(new Error('PCM storage queue full'));
      const bytes = buffer.byteLength;
      const data = buffer.slice(0);
      const index = sequence++;
      pendingBytes += bytes;
      const write = tail.then(async () => {
        if (failure) throw failure;
        await transaction('readwrite', store => store.add({sessionId,sequence:index,data}));
        totalBytes += bytes;
      });
      tail = write.catch(error => { failure = error; }).finally(() => { pendingBytes -= bytes; });
      return write;
    },
    async flush() { await tail; if (failure) throw failure; return totalBytes; },
    async close() { closed = true; await tail; db.close(); if (failure) throw failure; },
  };
}
