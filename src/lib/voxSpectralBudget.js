import { VOX_SPECTRAL_MODES } from './voxSpectralModes.js';
import { planVoxLatency } from './voxLatencyCompensation.js';

// Conservative estimated worst-block costs from isolated DSP benchmarks.
// Not a hardware guarantee. Reserve half of each render quantum for other FX.
const COST = Object.freeze({ recording:0.125, mixing:0.25, rendering:0.5 });
const MODES = ['rendering','mixing','recording'];
export function planVoxWorkload(tracks, {sampleRate=48000, quantum=128, reserve=0.5, offline=false, calibration}={}) {
  if (!Number.isFinite(sampleRate) || sampleRate<8000 || sampleRate>192000 || !Number.isSafeInteger(quantum) || quantum<32 || quantum>2048 || !Number.isFinite(reserve) || reserve<0 || reserve>=1) throw new RangeError('Invalid audio budget');
  const calibrated=calibration?.method==='main-thread-proxy-v1' && calibration.sampleRate===sampleRate && MODES.every(m=>Number.isFinite(calibration.costs?.[m]) && calibration.costs[m]>=0);
  const costs=Object.fromEntries(MODES.map(m=>[m,calibrated?Math.max(COST[m],calibration.costs[m]):COST[m]]));
  const ids=new Set();
  const sorted=tracks.map((track,index)=>{
    if (track.id==null || ids.has(track.id)) throw new Error('Unique track IDs required');
    ids.add(track.id);
    if (track.channels!==1 && track.channels!==2) throw new RangeError('Invalid channel count');
    if (track.mode!==undefined && !Object.hasOwn(COST,track.mode)) throw new RangeError('Invalid processing mode');
    if (!Number.isFinite(track.ratio) || track.ratio<0.5 || track.ratio>2) throw new RangeError('Invalid pitch ratio');
    return {...track,index};
  }).sort((a,b)=>Number(!!b.monitoring)-Number(!!a.monitoring)||Number(!!b.priority)-Number(!!a.priority)||a.index-b.index);
  const budgetMs=quantum/sampleRate*1000*(1-reserve);
  let usedMs=0;
  const allocations=[];
  for (const t of sorted) {
    const requested=t.monitoring?'recording':t.mode??(offline?'rendering':'mixing');
    const candidates=offline?[t.mode??'rendering']:MODES.slice(MODES.indexOf(requested));
    let mode=null,cost=0;
    if (t.enabled!==false && t.ratio!==1) for (const candidate of candidates) {
      const estimate=costs[candidate]*t.channels;
      if (offline || usedMs+estimate<=budgetMs) { mode=candidate;cost=estimate;break; }
    }
    usedMs+=cost;
    allocations.push({id:t.id,index:t.index,requested,mode,status:t.enabled===false||t.ratio===1?'dry':mode?'spectral':'deferred',latencySamples:mode?VOX_SPECTRAL_MODES[mode].frameSize:0,estimatedMs:cost});
  }
  allocations.sort((a,b)=>a.index-b.index);
  const latency=planVoxLatency(allocations,sampleRate);
  return {budgetMs,usedMs,offline,calibrated,tracks:allocations.map(({index,...t},i)=>({...t,delaySamples:latency.tracks[i].delaySamples})),latencySamples:latency.latencySamples};
}
