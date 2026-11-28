// Worker benchmark is a conservative proxy, not an audio thread measurement.
export function requestVoxCalibration(sampleRate,{createWorker=()=>new Worker(new URL('./voxCalibration.worker.js',import.meta.url),{type:'module'}),timeoutMs=250}={}){
  return new Promise(resolve=>{
    let worker,timer,finished=false;
    const finish=profile=>{if(finished)return;finished=true;clearTimeout(timer);try{worker?.terminate();}catch{/* already stopped */}resolve(profile);};
    try{
      worker=createWorker();
      worker.onmessage=({data})=>{const p=data?.profile;finish(p?.method==='main-thread-proxy-v1' && p.sampleRate===sampleRate && ['recording','mixing','rendering'].every(m=>Number.isFinite(p.costs?.[m])&&p.costs[m]>=0)?p:null);};
      worker.onerror=()=>finish(null);worker.onmessageerror=()=>finish(null);
      timer=setTimeout(()=>finish(null),timeoutMs);worker.postMessage({sampleRate});
    }catch{finish(null);}
  });
}
export function createAsyncVoxCalibrationCache(measure=requestVoxCalibration){
  const cache=new WeakMap();
  return context=>{
    if(!context||context.state==='closed')return Promise.resolve(null);
    if(!cache.has(context))cache.set(context,Promise.resolve().then(()=>measure(context.sampleRate)).catch(()=>null));
    return cache.get(context);
  };
}
