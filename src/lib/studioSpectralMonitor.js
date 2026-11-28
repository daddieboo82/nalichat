// Separate, explicitly enabled headphone-monitor path; never feeds the recorder.
export async function createStudioSpectralMonitor(context, source, {ratio=1,createNode, enabled=false}={}) {
  if(!Number.isFinite(ratio)||ratio<.6||ratio>1.6)throw new RangeError('Invalid monitor pitch');
  const gain=context.createGain();gain.gain.value=0;
  let processor=null,disposed=false;
  try{
    if(enabled && ratio!==1){
      const factory=createNode || (await import('./voxSpectralWorklet.js')).createVoxSpectralNode;
      processor=await factory(context,{mode:'recording',channels:1,ratio});
      if(processor.latencySamples!==512)throw Error('Unexpected monitor latency');
      source.connect(processor.node);processor.node.connect(gain);
    }else source.connect(gain);
    gain.connect(context.destination);
    return {latencySamples:processor?.latencySamples??0,setLevel(level){if(disposed)return;gain.gain.value=enabled&&Number.isFinite(level)?Math.max(0,Math.min(.25,level)):0;},dispose(){if(disposed)return;disposed=true;gain.gain.value=0;try{source.disconnect(processor?.node??gain);}finally{try{processor?.dispose();}finally{gain.disconnect();}}}};
  }catch(error){try{source.disconnect(processor?.node??gain);}catch{/* not connected */}try{processor?.dispose();}finally{gain.disconnect();}throw error;}
}
