// Standalone device-local PCM spool. Not wired into the live recorder yet.
// The caller owns a unique session ID and must explicitly remove its data.
const DB_NAME = 'nalichat-pcm-spool-v1';
const STORE = 'chunks';
export async function openStudioPcmSpool(sessionId, { indexedDB = globalThis.indexedDB, maxPendingBytes = 4 * 1024 * 1024, recoveryOnly = false, ownerId, scope, sampleRate } = {}) {
  if (typeof sessionId !== 'string' || !/^[a-z0-9_-]{16,128}$/i.test(sessionId)) throw new Error('Invalid PCM session ID');
  if (typeof ownerId !== 'string' || ownerId.length < 3 || ownerId.length > 255 ||
      typeof scope !== 'string' || !/^(draft|room:[a-z0-9_-]{8,100})$/i.test(scope) ||
      !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('Invalid PCM session metadata');
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
  // Read only one session at a time, in key order, without getAll().
  function walkSession(consume, mode = 'readonly') {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = tx.objectStore(STORE).openCursor();
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('PCM session scan failed'));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        try {
          if (cursor.value.sessionId === sessionId) {
            if (cursor.value.ownerId !== ownerId || cursor.value.scope !== scope || cursor.value.sampleRate !== sampleRate) throw new Error('PCM session metadata mismatch');
            consume(cursor);
          }
          cursor.continue();
        } catch (error) { try { tx.abort(); } catch {} reject(error); }
      };
    });
  }
  let sequence = 0, pendingBytes = 0, totalBytes = 0, failure = null, closed = false;
  let sealed = Boolean(recoveryOnly);
  let tail = Promise.resolve();
  // Never append to a previous session: sequence numbers start at zero.
  // A recovery handle is read-only except for explicit removal.
  if (!recoveryOnly) {
    let exists = false;
    try { await walkSession(() => { exists = true; }); }
    catch (error) { db.close(); throw error; }
    if (exists) { db.close(); throw new Error('PCM session already exists; open for recovery instead'); }
  }
  return {
    get pendingBytes() { return pendingBytes; },
    get totalBytes() { return totalBytes; },
    append(buffer) {
      if (closed || sealed || failure) return Promise.reject(failure || new Error('PCM spool closed'));
      if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.byteLength % 2) return Promise.reject(new Error('Invalid PCM chunk'));
      if (pendingBytes + buffer.byteLength > maxPendingBytes) return Promise.reject(new Error('PCM storage queue full'));
      const bytes = buffer.byteLength;
      const data = buffer.slice(0);
      const index = sequence++;
      pendingBytes += bytes;
      const write = tail.then(async () => {
        if (failure) throw failure;
        await transaction('readwrite', store => store.add({sessionId,ownerId,scope,sampleRate,sequence:index,data,createdAt:Date.now()}));
        totalBytes += bytes;
      });
      tail = write.catch(error => { failure = error; }).finally(() => { pendingBytes -= bytes; });
      return write;
    },
    async flush() { await tail; if (failure) throw failure; return totalBytes; },
    async assembleWav(requestedRate = sampleRate) {
      if (closed) throw new Error('PCM spool closed');
      const rate = Number(requestedRate);
      if (rate !== sampleRate || !Number.isInteger(rate) || rate < 8000 || rate > 192000) throw new Error('Unsupported PCM sample rate');
      sealed = true;
      await tail;
      // A failed write may leave a valid contiguous prefix worth recovering.
      const parts = [];
      let bytes = 0, expected = 0;
      await walkSession(cursor => {
        const {sequence: index, data} = cursor.value;
        if (index !== expected++ || !(data instanceof ArrayBuffer) || !data.byteLength || data.byteLength % 2) throw new Error('Invalid or missing PCM chunk');
        bytes += data.byteLength;
        if (bytes > 0xffffffff - 36) throw new Error('WAV size exceeds RIFF limit');
        parts.push(new Blob([data]));
      });
      if (!bytes) throw new Error('No captured PCM to assemble');
      const header = new ArrayBuffer(44), view = new DataView(header);
      const tag = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
      tag(0,'RIFF'); view.setUint32(4,bytes+36,true); tag(8,'WAVE');
      tag(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
      view.setUint16(22,1,true); view.setUint32(24,rate,true); view.setUint32(28,rate*2,true);
      view.setUint16(32,2,true); view.setUint16(34,16,true); tag(36,'data'); view.setUint32(40,bytes,true);
      return {audio:new Blob([header,...parts],{type:'audio/wav'}),duration:bytes/(rate*2),partial:Boolean(failure || recoveryOnly)};
    },
    async remove() {
      if (closed) throw new Error('PCM spool closed');
      sealed = true;
      await tail;
      await walkSession(cursor => cursor.delete(), 'readwrite');
      totalBytes = 0;
    },
    async close() { closed = true; await tail; db.close(); if (failure) throw failure; },
  };
}

 // Discover recoverable sessions without returning audio payloads to the caller.
 export async function listStudioPcmSessions(ownerId, scope, indexedDB = globalThis.indexedDB) {
   if (typeof ownerId !== 'string' || ownerId.length < 3 || ownerId.length > 255 ||
       typeof scope !== 'string' || !/^(draft|room:[a-z0-9_-]{8,100})$/i.test(scope)) throw new Error('Invalid PCM recovery scope');
   if (!indexedDB?.open) throw new Error('PCM storage unavailable');
   const db = await new Promise((resolve,reject) => {
     const req = indexedDB.open(DB_NAME,1);
     req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE,{keyPath:['sessionId','sequence']}); };
     req.onsuccess = () => resolve(req.result);
     req.onerror = req.onblocked = () => reject(req.error || new Error('PCM storage unavailable'));
   });
   try {
     return await new Promise((resolve,reject) => {
       const sessions = new Map();
       const tx = db.transaction(STORE,'readonly');
       const req = tx.objectStore(STORE).openCursor();
       tx.onerror = tx.onabort = () => reject(tx.error || new Error('PCM discovery failed'));
       tx.oncomplete = () => resolve([...sessions.values()].filter(s => !s.invalid).sort((a,b) => b.updatedAt-a.updatedAt).map(({invalid,...s})=>s));
       req.onsuccess = () => {
         const cursor = req.result;
         if (!cursor) return;
         const row = cursor.value;
         if (row.ownerId === ownerId && row.scope === scope) {
           const entry = sessions.get(row.sessionId) || {sessionId:row.sessionId,sampleRate:row.sampleRate,bytes:0,chunks:0,updatedAt:0,invalid:false};
           if (!Number.isInteger(row.sampleRate) || row.sampleRate < 8000 || row.sampleRate > 192000 ||
               entry.sampleRate !== row.sampleRate || row.sequence !== entry.chunks ||
               !(row.data instanceof ArrayBuffer) || !row.data.byteLength || row.data.byteLength % 2) entry.invalid = true;
           entry.chunks++;
           entry.bytes += row.data?.byteLength || 0;
           entry.updatedAt = Math.max(entry.updatedAt,Number(row.createdAt)||0);
           sessions.set(row.sessionId,entry);
         }
         cursor.continue();
       };
     });
   } finally { db.close(); }
 }
