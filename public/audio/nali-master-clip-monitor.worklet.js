// Sample overload latch plus optional cubic inter-sample estimate.
// This estimate is not an ITU-R BS.1770 compliant true-peak meter.
class NaliMasterClipMonitor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.latched = false;
    this.interSampleLatched = false;
    this.estimate = options?.processorOptions?.estimateInterSample === true;
    this.history = [new Float32Array(3), new Float32Array(3)];
    this.count = [0,0];
    this.port.onmessage = event => {
      if (event.data === 'reset') {
        this.latched = false;
        this.interSampleLatched = false;
      }
    };
  }
  process(inputs) {
    const channels = inputs[0] || [];
    for (let c=0;c<channels.length;c++) {
      const channel = channels[c];
      if (!this.estimate && this.latched) break;
      const h = this.history[c];
      if (h && !channel.length) this.count[c] = 0;
      for (let i=0;i<channel.length;i++) {
        const d = channel[i];
        if (!this.latched && Math.abs(d) >= 1) {
          this.latched = true;
          this.port.postMessage('clip');
        }
        if (!this.estimate || !h) continue;
        if (!Number.isFinite(d)) { this.count[c]=0; continue; }
        if (this.count[c] === 3 && !this.interSampleLatched) {
          const a=h[0], b=h[1], cc=h[2];
          // Catmull-Rom interpolant between b and cc, with one sample lookahead.
          const p=(cc-a)*0.5, q=a-2.5*b+2*cc-0.5*d, z=0.5*(d-a)+1.5*(b-cc);
          for (let phase=1;phase<=3;phase++) {
            const t=phase*0.25;
            if (Math.abs(b+t*(p+t*(q+t*z))) >= 1 && Math.abs(b)<1 && Math.abs(cc)<1) {
              this.interSampleLatched=true;
              this.port.postMessage('inter-sample');
              break;
            }
          }
        }
        h[0]=h[1]; h[1]=h[2]; h[2]=d;
        this.count[c]=Math.min(3,this.count[c]+1);
      }
    }
    for(let c=channels.length;c<2;c++) this.count[c]=0;
    return true;
  }
}
registerProcessor('nali-master-clip-monitor', NaliMasterClipMonitor);
