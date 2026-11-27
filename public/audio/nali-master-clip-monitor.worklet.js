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

// K-weighting coefficients in b0, b1, b2, a1, a2 order.
// The 44.1 kHz stages preserve the analog response of the 48 kHz
// stages by undoing and reapplying the bilinear transform.
const K_WEIGHTING = {
  44100: [
    [1.5308803241355344, -2.6513512928671936, 1.1693440263289745, -1.663901800496319, 0.7127748580936344],
    [0.9995600666184936, -1.9991201332369872, 0.9995600666184936, -1.9891696777723495, 0.9891990399071316],
  ],
  48000: [
    [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
    [1, -2, 1, -1.99004745483398, 0.99007225036621],
  ],
};

class NaliLoudnessWindow {
  constructor(rate) {
    this.coefficients = K_WEIGHTING[rate];
    this.blockFrames = rate / 10;
    this.ring = new Float64Array(30);
    this.filters = [new Float64Array(8),new Float64Array(8)];
    this.position = 0;
    this.blocks = 0;
    this.frames = 0;
    this.energy = 0;
  }
  filter(x,c) {
    const s = this.filters[c];
    const [shelf, highPass] = this.coefficients;
    const y = shelf[0]*x + shelf[1]*s[0] + shelf[2]*s[1] - shelf[3]*s[2] - shelf[4]*s[3];
    s[1]=s[0];s[0]=x;s[3]=s[2];s[2]=y;
    const z = highPass[0]*y + highPass[1]*s[4] + highPass[2]*s[5] - highPass[3]*s[6] - highPass[4]*s[7];
    s[5]=s[4];s[4]=y;s[7]=s[6];s[6]=z;
    return z;
  }
  value(n) {
    if(this.blocks<n) return null;
    let sum=0;
    for(let i=1;i<=n;i++) sum+=this.ring[(this.position+30-i)%30];
    return sum>0 ? -0.691+10*Math.log10(sum/n) : null;
  }
  process(channels, report) {
    if(!this.coefficients || channels.length<1 || channels.length>2) return;
    for(let i=0;i<channels[0].length;i++) {
      let e=0;
      for(let c=0;c<channels.length;c++) {
        const x=channels[c][i];
        const y=this.filter(Number.isFinite(x)?x:0,c);
        e+=y*y;
      }
      this.energy+=e;
      if(++this.frames===this.blockFrames) {
        this.ring[this.position]=this.energy/this.frames;
        this.position=(this.position+1)%30;
        this.blocks=Math.min(30,this.blocks+1);
        this.frames=0;this.energy=0;
        report({type:'loudness',momentary:this.value(4),shortTerm:this.value(30)});
      }
    }
  }
}

class NaliMasterClipMonitor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.latched = false;
    this.interSampleLatched = false;
    this.estimate = options?.processorOptions?.estimateInterSample === true;
    this.loudness = this.estimate ? new NaliLoudnessWindow(sampleRate) : null;
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
    this.loudness?.process(channels, value => this.port.postMessage(value));
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
