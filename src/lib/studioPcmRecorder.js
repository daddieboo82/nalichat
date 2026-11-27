// First-party lossless mono PCM WAV recorder, using AudioWorklet when available.
// The signal stays on-device until the user sends/saves the recorded track.
// If AudioWorklet setup fails, callers fall back to the tested MediaRecorder.
import { createStudioMediaRecorder } from './studioRecorderCodec';

const WORKLET_URL = '/audio/nali-pcm-capture.worklet.js';
const MAX_PCM_BYTES = 80 * 1024 * 1024;

export function pcm16WavBlob(chunks, sampleRate) {
  const rate = Math.round(sampleRate);
  if (!Number.isFinite(rate) || rate < 8000 || rate > 192000) throw new Error('Unsupported PCM sample rate');
  let bytes = 0;
  for (const chunk of chunks) {
    if (!(chunk instanceof ArrayBuffer) || chunk.byteLength % 2) throw new Error('Invalid PCM audio chunk');
    bytes += chunk.byteLength;
    if (bytes > MAX_PCM_BYTES) throw new Error('Recording exceeds safe memory limit');
  }
  const header = new ArrayBuffer(44);
  const dv = new DataView(header);
  const write = (offset, value) => { for (let i=0;i<value.length;i++) dv.setUint8(offset+i,value.charCodeAt(i)); };
  write(0, 'RIFF'); dv.setUint32(4, bytes + 36, true); write(8, 'WAVE');
  write(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  write(36, 'data'); dv.setUint32(40, bytes, true);
  return new Blob([header, ...chunks], {type: 'audio/wav'});
}

export async function createLosslessStudioRecorder(stream, {
  AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext,
  WorkletNodeType = globalThis.AudioWorkletNode,
  moduleUrl = WORKLET_URL,
} = {}) {
  if (!AudioContextType || !WorkletNodeType) throw new Error('AudioWorklet recording unavailable');
  const context = new AudioContextType({latencyHint:'interactive'});
  let source;
  let node;
  let mute;
  try {
    if (!context.audioWorklet?.addModule) throw new Error('AudioWorklet recording unavailable');
    await context.audioWorklet.addModule(moduleUrl);
    source = context.createMediaStreamSource(stream);
    node = new WorkletNodeType(context, 'nali-pcm-capture', {numberOfInputs:1, numberOfOutputs:1, outputChannelCount:[1]});
    mute = context.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(context.destination);
    await context.resume();
  } catch (error) {
    // Each node may fail to disconnect independently. Cleanup must not mask
    // the original startup error or delay fallback to MediaRecorder when
    // AudioContext.close() hangs or throws on a damaged browser audio device.
    for (const audioNode of [source, node, mute]) {
      try { audioNode?.disconnect(); } catch {}
    }
    void Promise.resolve().then(() => context.close()).catch(() => {});
    throw error;
  }

  let chunks = [];
  let byteLength = 0;
  let completed = false;
  let pending = false;
  let watchdog = null;
  const recorder = {
    mimeType: 'audio/wav', stream, state: 'inactive',
    get capturedByteLength() { return byteLength; },
    ondataavailable: null, onstop: null, onerror: null,
    start() {
      if (this.state !== 'inactive') throw new Error('Recorder already started');
      this.state = 'recording';
      try {
        node.port.postMessage({type:'start'});
      } catch (error) {
        // A closed worklet port must not leave a phantom active recording.
        // Studio's startup catch will release its microphone stream.
        this.dispose();
        throw error;
      }
    },
    // Snapshot only PCM already received from the worklet; never clear the
    // ongoing recording. Each result contains its own complete WAV header.
    // This is used for optional device-local crash recovery, not cloud upload.
    snapshot() {
      if (completed || this.state !== 'recording' || byteLength < context.sampleRate * 2) return null;
      return pcm16WavBlob(chunks, context.sampleRate);
    },
    requestData() { /* PCM is emitted on stop as a single valid WAV file. */ },
    dispose() {
      if (completed) return;
      completed = true;
      this.state = 'inactive';
      clearTimeout(watchdog);
      chunks = [];
      try { source.disconnect(); node.disconnect(); mute.disconnect(); } catch {}
      void context.close().catch(() => {});
    },
    stop() {
      if (this.state !== 'recording') return;
      this.state = 'inactive';
      pending = true;
      // Install the watchdog before communicating with the worklet. A closed
      // MessagePort can throw synchronously, so recover buffered audio through
      // the regular finalizer instead of leaving Studio waiting for onstop.
      watchdog = setTimeout(() => { void finish(new Error('Lossless capture could not finalize safely')); }, 1500);
      try {
        node.port.postMessage({type:'flush'});
      } catch (error) {
        void finish(error);
      }
    },
  };
  const finish = async (error) => {
    if (completed) return;
    completed = true;
    recorder.state = 'inactive';
    clearTimeout(watchdog);
    try {
      source.disconnect(); node.disconnect(); mute.disconnect();
    } catch {}
    // Closing an AudioContext can remain pending when a browser suspends
    // audio services. Disconnect immediately, but do not block delivery of
    // captured bytes or onstop on the context's asynchronous close promise.
    void Promise.resolve().then(() => context.close()).catch(() => {});
    // An unexpected worklet shutdown can still leave valid PCM in memory.
    // Emit that partial WAV before the error/stop notifications so Studio's
    // recovery handler can preserve the captured samples. Never claim an
    // empty or unencodable recording was saved.
    let encodeError = null;
    if (!error || chunks.length > 0) {
      let audio = null;
      try {
        audio = pcm16WavBlob(chunks, context.sampleRate);
      } catch (caught) {
        encodeError = caught;
      }
      if (audio) {
        try { recorder.ondataavailable?.({data:audio}); }
        catch (callbackError) { console.warn('Studio PCM audio delivery callback failed:', callbackError); }
      }
    }
    if (error || encodeError) {
      try { recorder.onerror?.({error: error || encodeError}); }
      catch (callbackError) { console.warn('Studio PCM error callback failed:', callbackError); }
    }
    chunks = [];
    // Always deliver completion, even if the hosting UI's other callbacks
    // throw. Otherwise its recording-finalization guard may remain locked.
    try { recorder.onstop?.(); }
    catch (callbackError) { console.warn('Studio PCM stop callback failed:', callbackError); }
  };
  node.port.onmessage = ({data}) => {
    if (completed) return;
    if (data?.type === 'pcm') {
      const chunk = data.buffer;
      if (!(chunk instanceof ArrayBuffer) || chunk.byteLength % 2) {
        void finish(new Error('Invalid PCM samples'));
        return;
      }
      byteLength += chunk.byteLength;
      if (byteLength > MAX_PCM_BYTES) {
        void finish(new Error('Recording length exceeds device memory limit'));
        return;
      }
      chunks.push(chunk);
    } else if (data?.type === 'flushed' && pending) {
      void finish();
    }
  };
  node.port.onmessageerror = () => { void finish(new Error('PCM capture stopped unexpectedly')); };
  return recorder;
}

export async function createPreferredStudioRecorder(stream, {
  MediaRecorderType = globalThis.MediaRecorder,
  createLossless = createLosslessStudioRecorder,
} = {}) {
  try {
    const recorder = await createLossless(stream);
    return { recorder, codec:'audio/wav', lossless:true, backend:'pcm-worklet' };
  } catch {
    const fallback = createStudioMediaRecorder(stream, MediaRecorderType);
    return { ...fallback, backend:'media-recorder' };
  }
}
