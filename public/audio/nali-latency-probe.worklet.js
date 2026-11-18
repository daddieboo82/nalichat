// NaliChat native acoustic latency probe. Audio and timestamps remain in
// the local AudioContext; no vocal content leaves the browser.
class NaliLatencyProbeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.batch = new Float32Array(2048);
    this.position = 0;
    this.frame = 0;
    this.port.onmessage = ({ data }) => {
      if (data?.type === 'flush') {
        this.send();
        this.port.postMessage({ type: 'flushed' });
      }
    };
  }
  send() {
    if (!this.position) return;
    const slice = this.batch.slice(0, this.position);
    this.port.postMessage(
      { type: 'audio', firstFrame: this.frame, samples: slice.buffer },
      [slice.buffer],
    );
    this.position = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    const other = inputs[0]?.[1];
    if (!input) return true;
    if (this.position === 0) this.frame = currentFrame;
    for (let i = 0; i < input.length; i++) {
      this.batch[this.position++] = other ? (input[i] + other[i]) / 2 : input[i];
      if (this.position === this.batch.length) this.send();
    }
    return true;
  }
}
registerProcessor('nali-latency-probe', NaliLatencyProbeProcessor);
