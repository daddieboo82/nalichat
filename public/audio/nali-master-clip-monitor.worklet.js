// Monitor sample clipping on the audio rendering thread, without altering playback.
class NaliMasterClipMonitor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.latched = false;
    this.port.onmessage = event => {
      if (event.data === 'reset') this.latched = false;
    };
  }
  process(inputs) {
    if (!this.latched) {
      for (const channel of inputs[0] || []) {
        for (let i = 0; i < channel.length; i++) {
          if (Math.abs(channel[i]) >= 1) {
            this.latched = true;
            this.port.postMessage('clip');
            return true;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor('nali-master-clip-monitor', NaliMasterClipMonitor);
