// Original NaliChat PCM capture worklet. Collect 16-bit mono samples in the
// audio render thread without loss-inducing speech codecs or remote services.
class NaliPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frames = new Int16Array(4096);
    this.position = 0;
    this.enabled = true;
    this.port.onmessage = ({data}) => {
      if (data?.type === 'flush') {
        this.send();
        this.enabled = false;
        this.port.postMessage({type:'flushed'});
      }
    };
  }
  send() {
    if (this.position === 0) return;
    const bytes = this.frames.slice(0, this.position).buffer;
    this.port.postMessage({type:'pcm', buffer:bytes}, [bytes]);
    this.position = 0;
  }
  process(inputs) {
    if (!this.enabled) return true;
    const input = inputs[0];
    const first = input?.[0];
    if (!first) return true;
    const second = input[1];
    for (let i=0;i<first.length;i++) {
      const mono = second ? (first[i]+second[i])*0.5 : first[i];
      const safe = Number.isFinite(mono) ? Math.max(-1,Math.min(1,mono)) : 0;
      this.frames[this.position++] = safe < 0 ? Math.round(safe*32768) : Math.round(safe*32767);
      if (this.position === this.frames.length) this.send();
    }
    return true;
  }
}
registerProcessor('nali-pcm-capture', NaliPcmCaptureProcessor);
