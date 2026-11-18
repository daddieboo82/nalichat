import { base44 } from '@/api/base44Client';
import { audioBufferToWav, bufferToWaveform } from './audioProcessing';
import { studioClipAudioRange } from './studioClipAudioRange';

async function useProfiles(mode, operation) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('nalichat-voxshift', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('profiles', { keyPath: ['owner', 'id'] });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('profiles', mode);
      const request = operation(transaction.objectStore('profiles'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error || new Error('Voice profile storage failed.'));
    });
  } finally {
    database.close();
  }
}

export const readVoiceProfiles = (owner) => useProfiles('readonly', store =>
  store.getAll(IDBKeyRange.bound([owner, ''], [owner, '\uffff'])));
export const saveVoiceProfile = (profile) => useProfiles('readwrite', store => store.put(profile));
export const deleteVoiceProfile = (owner, id) => useProfiles('readwrite', store => store.delete([owner, id]));

async function decodeAudio(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audio = new AudioContextClass();
  try {
    return await audio.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await audio.close().catch(() => {});
  }
}

export async function prepareVoiceAudio(blob, track) {
  if (blob.size > 50 * 1024 * 1024) throw new Error('Choose an audio file under 50 MB.');
  const input = await decodeAudio(blob);
  const range = track ? studioClipAudioRange(track, input.duration) : { offset: 0, duration: input.duration };
  const minimum = track ? 1 : 3;
  if (!range || range.duration < minimum || range.duration > 30) {
    throw new Error(`Choose ${minimum}–30 seconds of isolated ${track ? 'lead vocal' : 'reference audio'}.`);
  }
  const rate = 24000;
  const context = new OfflineAudioContext(1, Math.floor(range.duration * rate), rate);
  const source = context.createBufferSource();
  source.buffer = input;
  source.connect(context.destination);
  source.start(0, range.offset, range.duration);
  return audioBufferToWav(await context.startRendering());
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function generateVoiceMatch({ profile, mode, text, track }) {
  const payload = { consent: true, mode, reference: await toBase64(profile.wav) };
  if (mode === 'speech') {
    payload.text = text.trim();
  } else {
    const response = await fetch(track.audioUrl);
    if (!response.ok) throw new Error('Could not read the selected vocal clip.');
    const source = await prepareVoiceAudio(await response.blob(), track);
    payload.source = await toBase64(source);
  }

  let data;
  try {
    ({ data } = await base44.functions.invoke('voxShiftGenerate', payload));
  } catch (error) {
    const message = error.response?.data?.error;
    throw new Error(typeof message === 'string' ? message : 'VoxShift AI is unavailable right now.');
  }
  if (typeof data?.wav !== 'string' || data.wav.length > 2_666_668) {
    throw new Error('The provider returned invalid audio.');
  }
  const bytes = Uint8Array.from(atob(data.wav), char => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/wav' });
  const decoded = await decodeAudio(blob);
  return { blob, waveform: bufferToWaveform(decoded), duration: decoded.duration };
}
