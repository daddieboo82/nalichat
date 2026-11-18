// Authenticated, account-scoped model checkpoints stored on NaliChat servers.
// No raw audio is sent. This replaces browser IndexedDB as source of truth.
import { base44 } from '@/api/base44Client';
import { createNaliVoiceModel, validateNaliVoiceModel } from './naliVoiceCore';

async function request(action, fields = {}) {
  const response = await base44.functions.invoke('naliVoicePrivateModel', { action, ...fields });
  const data = response?.data;
  if (!data || data.error) throw new Error(data?.error || 'Private voice model service unavailable.');
  return data;
}

export async function getPrivateNaliVoiceStatus() {
  return request('get');
}

export async function updatePrivateNaliVoiceConsent(enabled) {
  if (typeof enabled !== 'boolean') throw new Error('Consent choice required.');
  return request('set_consent', { enabled });
}

export async function readPrivateNaliVoiceModel() {
  const data = await getPrivateNaliVoiceStatus();
  const model = data.model ? {
    ...data.model,
    w1: new Float32Array(data.model.w1),
    b1: new Float32Array(data.model.b1),
    w2: new Float32Array(data.model.w2),
  } : createNaliVoiceModel();
  validateNaliVoiceModel(model);
  model._serverRevision = data.revision;
  return model;
}

export async function savePrivateNaliVoiceModel(_owner, model) {
  validateNaliVoiceModel(model);
  if (!Number.isSafeInteger(model._serverRevision)) {
    throw new Error('Reload the private voice model before saving.');
  }
  const payload = {
    format: model.format, taps: model.taps, hidden: model.hidden,
    trainedSteps: model.trainedSteps, b2: model.b2,
    w1: Array.from(model.w1), b1: Array.from(model.b1), w2: Array.from(model.w2),
  };
  const result = await request('save', { model: payload, revision: model._serverRevision });
  model._serverRevision = result.revision;
}

export async function clearPrivateNaliVoiceModel() {
  return request('erase');
}
