// Local per-account neural-model checkpoint storage. Never store raw speech.
// Private IndexedDB database scoped to this browser origin.
import { createNaliVoiceModel, validateNaliVoiceModel } from './naliVoiceCore';

const DB_NAME = 'nalivoice-private-models-v1';
const STORE = 'models';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'owner' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Voice model storage unavailable.'));
  });
}

async function transaction(owner, mode, callback) {
  if (typeof owner !== 'string' || !owner) throw new Error('Voice model owner required.');
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = callback(tx.objectStore(STORE), owner);
      req.onerror = () => reject(req.error || new Error('Voice model storage failed.'));
      tx.onabort = () => reject(tx.error || new Error('Voice model storage failed.'));
      tx.oncomplete = () => resolve(req.result);
    });
  } finally {
    db.close();
  }
}

export async function readPrivateNaliVoiceModel(owner) {
  const row = await transaction(owner, 'readonly', (store, id) => store.get(id));
  if (!row) return createNaliVoiceModel();
  const model = { ...row.model,
    w1: new Float32Array(row.model.w1),
    b1: new Float32Array(row.model.b1),
    w2: new Float32Array(row.model.w2),
  };
  validateNaliVoiceModel(model);
  return model;
}

export async function savePrivateNaliVoiceModel(owner, model) {
  validateNaliVoiceModel(model);
  const copy = {
    ...model, w1: new Float32Array(model.w1),
    b1: new Float32Array(model.b1), w2: new Float32Array(model.w2),
  };
  await transaction(owner, 'readwrite', (store, id) => store.put({
    owner: id, model: copy, updatedAt: new Date().toISOString(),
  }));
}

export async function clearPrivateNaliVoiceModel(owner) {
  await transaction(owner, 'readwrite', (store, id) => store.delete(id));
}
