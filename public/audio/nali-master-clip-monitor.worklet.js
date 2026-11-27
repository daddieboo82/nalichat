// Sample overload latch plus optional cubic inter-sample estimate.
// This estimate is not an ITU-R BS.1770 compliant true-peak meter.
function cubicOverload(b,p,q,z) {
  const exceeds = t => t > 0 && t < 1 && Math.abs(b+t*(p+t*(q+t*z))) >= 1;
  // derivative p + 2*q*t + 3*z*t*t
  if (Math.abs(z)<1e-12) return Math.abs(q)>1e-12 && exceeds(-p/(2*q));
  const discriminant = 4*q*q-12*z*p;
  if (discriminant<0) return false;
  const root = Math.sqrt(discriminant);
  return exceeds((-2*q+root)/(6*z)) || exceeds((-2*q-root)/(6*z));
}

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
          // Evaluate the actual stationary points of the cubic instead of
          // sampling only three fixed phases. This remains an approximation
          // of the reconstructed signal, not a band-limited true-peak meter.
          if (Math.abs(b)<1 && Math.abs(cc)<1 && cubicOverload(b,p,q,z)) {
            this.interSampleLatched=true;
            this.port.postMessage('inter-sample');
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
