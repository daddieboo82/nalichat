import { planVoxWorkload } from './voxSpectralBudget.js';
import { connectVoxCompensation } from './voxLatencyCompensation.js';

// Prepare a complete fixed-latency graph before connecting any audio source.
// This is an experimental adapter, not yet wired into Studio transport.
// Deferred effects require explicit caller approval; never silently bypass.
export async function prepareVoxSpectralGraph(context, tracks, {createNode, allowDeferred=false, offline=false, reserve=0.5}={}) {
  if (typeof createNode !== 'function') throw new TypeError('Spectral node factory required');
  const plan=planVoxWorkload(tracks,{sampleRate:context.sampleRate,offline,reserve});
  const deferred=plan.tracks.filter(t=>t.status==='deferred').map(t=>t.id);
  if (deferred.length && !allowDeferred) return {status:'deferred',plan,deferred};
  const routes=[];
  let disposed=false,connected=false;
  function dispose(){
    if(disposed)return;disposed=true;
    for(const route of routes.slice().reverse()){
      if(route.connected)try{route.source.disconnect(route.entry);}catch{/* detached */}
      try{route.compensation?.dispose();}catch{/* detached */}
      try{route.entry.disconnect();}catch{/* detached */}
      try{route.processor?.dispose();}catch{/* detached */}
    }
  }
  try {
    for (let i=0;i<tracks.length;i++) {
      const t=tracks[i],allocation=plan.tracks[i];
      if(!t.source?.connect || !t.destination)throw new TypeError('Track source and destination required');
      const entry=context.createGain();
      const route={source:t.source,entry,processor:null,compensation:null,connected:false};routes.push(route);
      let output=entry;
      if(allocation.mode){
        const processor=await createNode(context,{mode:allocation.mode,ratio:t.ratio,channels:t.channels});
        route.processor=processor;
        if(processor.latencySamples!==allocation.latencySamples)throw new Error('Unexpected spectral latency');
        entry.connect(processor.node);output=processor.node;
      }
      route.compensation=connectVoxCompensation(context,output,t.destination,allocation.delaySamples);
    }
  }catch(error){dispose();throw error;}
  return {status:'ready',plan,deferred,connect(){
    if(disposed)throw new Error('Graph disposed');if(connected)return;
    try{for(const route of routes){route.source.connect(route.entry);route.connected=true;}connected=true;}catch(error){dispose();throw error;}
  },dispose};
}
