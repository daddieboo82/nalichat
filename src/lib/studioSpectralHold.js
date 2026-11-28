// Hold the playback clock until media seeks and DSP resets both finish.
// New jumps during a reset require a fresh reset at the latest position.
export function createStudioSpectralHold() {
  let pending=null;
  return {
    get pending(){return pending!==null;},
    cancel(){pending=null;},
    begin({pause,refresh,settle,onFailure}) {
      if(pending){if(settle)pending.revision++;return pending.promise;}
      const request={promise:null,revision:0};pending=request;
      request.promise=(async()=>{
        try{
          pause();
          do {
            const revision=request.revision;
            if(settle){await Promise.resolve();await settle(()=>pending===request);}
            if(pending!==request)return false;
            if(revision!==request.revision)continue;
            const result=await refresh();
            if(pending!==request)return false;
            if(result.status!=='ready'){onFailure(result);return false;}
            if(revision===request.revision)return true;
          }while(pending===request);
          return false;
        }catch(error){if(pending===request)onFailure({status:'failed',reason:error.message});return false;}
        finally{if(pending===request)pending=null;}
      })();
      return request.promise;
    },
  };
}

// A currentTime assignment can finish asynchronously; do not resume on the
// worklet ACK alone. Poll the latest active media, with bounded cancellation.
export async function waitForStudioMediaSeek(getElements,isCurrent,{timeoutMs=3000,intervalMs=10}={}) {
  const deadline=Date.now()+timeoutMs;
  while(isCurrent()){
    const elements=getElements();
    if(elements.some(a=>a.error))throw Error('Media seek failed');
    if(elements.every(a=>!a.seeking && a.readyState>=2))return;
    if(Date.now()>=deadline)throw Error('Media seek timed out');
    await new Promise(resolve=>setTimeout(resolve,intervalMs));
  }
}
