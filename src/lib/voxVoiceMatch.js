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
  const maximum = track ? 60 : 30;
  if (!range || range.duration < minimum || range.duration > maximum) {
    throw new Error(`Choose ${minimum}–${maximum} seconds of isolated ${track ? 'lead vocal' : 'reference audio'}.`);
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

async function invokeVoiceMatch(payload) {
  try {
    const { data } = await base44.functions.invoke('voxShiftGenerate', payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.error;
    const failure = new Error(typeof message === 'string' ? message : 'VoxShift AI is unavailable right now.');
    failure.status = error.response?.status;
    throw failure;
  }
}

export async function getVoiceMatchModes() {
  const data = await invokeVoiceMatch({ action: 'capabilities' });
  if (!Array.isArray(data?.modes) || !data.modes.length) throw new Error('Voice Match provider is unavailable.');
  return data.modes;
}

function waitForNextCheck(signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, 5000);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

export async function generateVoiceMatch({ profile, mode, text, track, signal, onStatus }) {
  const payload = { consent: true, mode, reference: await toBase64(profile.wav) };
  if (mode === 'speech') {
    payload.text = text.trim();
  } else {
    const response = await fetch(track.audioUrl);
    if (!response.ok) throw new Error('Could not read the selected vocal clip.');
    const source = await prepareVoiceAudio(await response.blob(), track);
    payload.source = await toBase64(source);
  }

  signal.throwIfAborted();
  const { jobId } = await invokeVoiceMatch(payload);
  if (typeof jobId !== 'string' || !/^[a-f0-9]{32}$/.test(jobId)) {
    throw new Error('The provider did not return a valid job.');
  }
  signal.throwIfAborted();
  onStatus('queued');
  const deadline = Date.now() + 8 * 60_000;
  let data;
  let transientFailures = 0;
  while (Date.now() < deadline) {
    await waitForNextCheck(signal);
    try {
      data = await invokeVoiceMatch({ action: 'status', jobId });
      transientFailures = 0;
    } catch (error) {
      signal.throwIfAborted();
      if (error.status !== 502 || ++transientFailures >= 3) throw error;
      continue;
    }
    signal.throwIfAborted();
    if (data?.status === 'complete') break;
    if (data?.status === 'failed') throw new Error('The voice provider could not generate audio.');
    if (!['queued', 'running'].includes(data?.status)) throw new Error('The provider returned an invalid job status.');
    onStatus(data.status);
  }
  if (data?.status !== 'complete') throw new Error('This voice job took too long to finish.');
  if (typeof data?.wav !== 'string' || data.wav.length > 4_000_000) {
    throw new Error('The provider returned invalid audio.');
  }
  const bytes = Uint8Array.from(atob(data.wav), char => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/wav' });
  const decoded = await decodeAudio(blob);
  return { blob, waveform: bufferToWaveform(decoded), duration: decoded.duration };
}
