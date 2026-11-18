// Mobile Studio device-only recovery vault. Stores *completed* microphone
// captures on the same device, separate from NaliVoice model training and
// account cloud storage. Data is private to the browser origin, NOT encrypted
// against another script running on that same origin. Browser storage can be
// cleared by the OS, user, or private browsing policies.
import { studioRecoveryStorageHealth, isStudioStorageQuotaError } from './studioRecoveryStorageHealth';

const DB_NAME = 'nalichat-studio-take-recovery-v1';
const STORE = 'takes';
const MAX_BYTES = 60 * 1024 * 1024;
const MAX_TAKES_PER_SCOPE = 8;

function validOwner(ownerId) {
  return typeof ownerId === 'string' && ownerId.length > 2 && ownerId.length < 256;
}
function validScope(scope) {
  return typeof scope === 'string' && /^(draft|room:[a-z0-9_-]{8,100})$/i.test(scope);
}
function keyOf(ownerId, scope) {
  if (!validOwner(ownerId) || !validScope(scope)) throw new Error('Sign in to recover a take in this Studio session.');
  return `${ownerId}::${scope}`;
}
export function studioRecoveryScope(roomId) {
  if (roomId == null || roomId === '') return 'draft';
  if (typeof roomId !== 'string' || !/^[a-z0-9_-]{8,100}$/i.test(roomId)) throw new Error('Invalid Studio room identifier.');
  return `room:${roomId}`;
}
function openDatabase(indexedDBImpl) {
  return new Promise((resolve, reject) => {
    if (!indexedDBImpl?.open) return reject(new Error('Device recovery storage is unavailable.'));
    const request = indexedDBImpl.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('ownerScope', 'ownerScope', {unique:false});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open device recovery storage.'));
    request.onblocked = () => reject(new Error('Device recovery storage is blocked by another tab.'));
  });
}
function runTransaction(db, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Device recording recovery failed.'));
    tx.onabort = () => reject(tx.error || new Error('Device recording recovery was canceled.'));
    try {
      const request = action(tx.objectStore(STORE));
      if (request) {
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => { try { tx.abort(); } catch {} };
      }
    } catch (error) {
      try {tx.abort();} catch {}
      reject(error);
    }
  });
}
async function withDatabase(indexedDBImpl, callback) {
  const db = await openDatabase(indexedDBImpl);
  try { return await callback(db); }
  finally { db.close(); }
}
export async function listStudioRecoveryTakes(ownerId, scope, indexedDBImpl = globalThis.indexedDB) {
  const ownerScope = keyOf(ownerId,scope);
  return withDatabase(indexedDBImpl,async db => {
    const rows = await runTransaction(db,'readonly', store => store.index('ownerScope').getAll(ownerScope));
    return (rows || []).filter(row => row?.ownerScope === ownerScope &&
      ((row?.audio instanceof Blob && row.audio.size > 0) ||
       (row?.audioBytes instanceof ArrayBuffer && row.audioBytes.byteLength > 0)))
      .sort((a,b) => b.createdAt - a.createdAt)
      .map(({id, createdAt, name, duration, bytes, mimeType, partial}) => ({id,createdAt,name,duration,bytes,mimeType,partial:Boolean(partial)}));
  });
}
export async function saveStudioRecoveryTake({
  ownerId, scope, audio, name = 'Mobile Vocal', duration, startTime = 0,
  id = globalThis.crypto?.randomUUID?.(), partial = false, replaceExisting = false,
}, indexedDBImpl = globalThis.indexedDB) {
  const ownerScope = keyOf(ownerId,scope);
  if (!id || typeof id !== 'string' || !/^[a-z0-9_-]{8,128}$/i.test(id) ||
      !(audio instanceof Blob) || !audio.size || audio.size > MAX_BYTES ||
      !audio.type.startsWith('audio/') ||
      !Number.isFinite(duration) || duration < 0 || duration > 24*3600 ||
      !Number.isFinite(startTime) || startTime < 0 || startTime > 24*3600) {
    throw new Error('Completed take cannot be stored in device recovery.');
  }
  return withDatabase(indexedDBImpl, async db => {
    const existing = await runTransaction(db,'readonly', store => store.index('ownerScope').getAll(ownerScope));
    if (replaceExisting && !(existing || []).some(row => row.id === id && row.ownerScope === ownerScope)) {
      const collision = await runTransaction(db,'readonly', store => store.get(id));
      if (collision && collision.ownerScope !== ownerScope) throw new Error('Device recovery ID is already in use.');
    }
    if ((existing || []).length >= MAX_TAKES_PER_SCOPE &&
        !(replaceExisting && (existing || []).some(row => row.id === id))) {
      throw new Error('Device recovery is full. Recover or delete older takes before recording more.');
    }
    // Browser quotas are origin-wide. Account for the size of the previous
    // checkpoint when replacing a recording (do not double-count it).
    const previous = replaceExisting
      ? await runTransaction(db,'readonly', store => store.get(id)) : null;
    const previousBytes = previous?.ownerScope === ownerScope ? Number(previous.bytes) || 0 : 0;
    const growth = Math.max(0,audio.size - previousBytes);
    const storage = await studioRecoveryStorageHealth({expectedAdditionalBytes:growth});
    if (storage.supported && storage.freeBytes < growth + 2*1024*1024) {
      const quotaError = new Error('Not enough device storage for a recording recovery backup. Save your Studio session to the cloud.');
      quotaError.name = 'QuotaExceededError';
      throw quotaError;
    }
    const record = {
      id, ownerScope, ownerId, scope, name: String(name).slice(0,90),
      audio, bytes: audio.size, mimeType: audio.type,
      duration, startTime, partial:Boolean(partial), createdAt: Date.now(),
    };
    try {
      await runTransaction(db,'readwrite', store => replaceExisting ? store.put(record) : store.add(record));
    } catch (blobError) {
      if (isStudioStorageQuotaError(blobError)) throw blobError;
      // WebKit/Safari implementations may abort transactions when serializing
      // a Blob even though IndexedDB itself is available. Retry using a
      // standard ArrayBuffer; this preserves bytes and MIME without cloud IO.
      const audioBytes = await audio.arrayBuffer();
      const portable = { ...record, audio: null, audioBytes };
      try {
        await runTransaction(db,'readwrite', store => replaceExisting ? store.put(portable) : store.add(portable));
      } catch { throw blobError; }
    }
    return { id:record.id, bytes:record.bytes, createdAt:record.createdAt };
  });
}
export async function getStudioRecoveryTake(ownerId, scope, id, indexedDBImpl = globalThis.indexedDB) {
  const ownerScope = keyOf(ownerId,scope);
  if (typeof id !== 'string' || !id) throw new Error('Invalid recovery take.');
  return withDatabase(indexedDBImpl,async db => {
    const record = await runTransaction(db,'readonly', store => store.get(id));
    if (!record || record.ownerScope !== ownerScope) throw new Error('This take is no longer available to recover.');
    const audio = record.audio instanceof Blob ? record.audio :
      record.audioBytes instanceof ArrayBuffer
        ? new Blob([record.audioBytes], {type:record.mimeType || 'audio/wav'}) : null;
    if (!audio || !audio.size || audio.size > MAX_BYTES || !audio.type.startsWith('audio/')) {
      throw new Error('This take is no longer available to recover.');
    }
    return {...record, audio, audioBytes:undefined};
  });
}
export async function deleteStudioRecoveryTake(ownerId, scope, id, indexedDBImpl = globalThis.indexedDB) {
  await getStudioRecoveryTake(ownerId,scope,id,indexedDBImpl);
  return withDatabase(indexedDBImpl,db => runTransaction(db,'readwrite',store => store.delete(id)));
}
