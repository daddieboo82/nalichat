// Vite emits a bundled module from the same DSP core used by offline export.
import workletUrl from './voxSpectralPitch.worklet.js?worker&url';
import { createVoxResetHandshake } from './voxResetHandshake.js';
import { resolveVoxSpectralOptions } from './voxSpectralModes.js';
const loaded = new WeakMap();
export async function createVoxSpectralNode(context, options = {}) {
  if (!context?.audioWorklet || typeof globalThis.AudioWorkletNode !== 'function') throw new Error('Spectral AudioWorklet unavailable');
  options = resolveVoxSpectralOptions(options);
  const channels = options.channels ?? 2;
  if (channels !== 1 && channels !== 2) throw new RangeError('Expected mono or stereo');
  if (!loaded.has(context)) {
    const pending = context.audioWorklet.addModule(workletUrl).catch(error => { loaded.delete(context); throw error; });
    loaded.set(context, pending);
  }
  await loaded.get(context);
  const node = new AudioWorkletNode(context, 'nali-vox-spectral', {numberOfInputs:1, numberOfOutputs:1, channelCount:channels, channelCountMode:'explicit', channelInterpretation:'speakers', outputChannelCount:[channels], processorOptions:{...options, channels}});
  const handshake=createVoxResetHandshake(node.port);
  let disposed=false;
  return {node, latencySamples:options.frameSize ?? 2048, reset:handshake.reset, dispose(){if(disposed)return;disposed=true;handshake.dispose();try{node.port.postMessage({type:'dispose'});}finally{try{node.disconnect();}finally{node.port.close();}}}};
}
