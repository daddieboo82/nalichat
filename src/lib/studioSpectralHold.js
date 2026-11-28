// Coalesce timeline jumps while the paused mixer clears its buffers.
// The caller must gate its playback clock and boundary starts on pending.
export function createStudioSpectralHold() {
  let pending=null;
  return {
    get pending(){return pending!==null;},
    cancel(){pending=null;},
    begin({pause,refresh,onFailure}) {
      if(pending)return pending.promise;
      const request={promise:null};pending=request;
      request.promise=(async()=>{
        try{pause();const result=await refresh();if(pending!==request)return false;if(result.status!=='ready'){onFailure(result);return false;}return true;}
        catch(error){if(pending===request)onFailure({status:'failed',reason:error.message});return false;}
        finally{if(pending===request)pending=null;}
      })();
      return request.promise;
    },
  };
}
