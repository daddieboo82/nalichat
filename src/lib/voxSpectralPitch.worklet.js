import { createVoxSpectralStream } from './voxSpectralPitch.js';

// Experimental fixed-ratio processor. A separate stream per channel preserves
// channel isolation. Do not attach to the production mixer until compensated.
class VoxSpectralProcessor extends AudioWorkletProcessor {
  constructor({ processorOptions = {} } = {}) {
    super();
    const { ratio = 1, frameSize = 2048, hopSize = 256, formantStrength = 0, levelStrength = 0, channels = 2 } = processorOptions;
    if (channels !== 1 && channels !== 2) throw new RangeError('Expected mono or stereo');
    this.streams = Array.from({length: channels}, () => createVoxSpectralStream(ratio, {frameSize, hopSize, formantStrength, levelStrength, sampleRate}));
    this.silence = new Float32Array(128);
    this.disposed = false;
    this.port.onmessage = ({data}) => { if (data?.type === 'dispose') this.disposed = true; };
  }
  process(inputs, outputs) {
    const output = outputs[0] || [], input = inputs[0] || [];
    if (this.disposed) { for (const channel of output) channel.fill(0); return false; }
    for (let i=0; i<output.length; i++) {
      const dest = output[i], source = input[i];
      if (!this.streams[i]) { dest.fill(0); continue; }
      if (this.silence.length !== dest.length) this.silence = new Float32Array(dest.length);
      this.streams[i].process(source || this.silence, dest);
    }
    return true;
  }
}
registerProcessor('nali-vox-spectral', VoxSpectralProcessor);
