// A pending preparation belongs to exactly one transport attempt and project.
// A stale completion must never reset a newer preparation.
export async function prepareStudioSpectralStart({pending, attempt, epoch, currentAttempt, currentEpoch, mounted, prepare, reset, warn}) {
  pending.current=attempt;
  const current=()=>pending.current===attempt && currentAttempt()===attempt && currentEpoch()===epoch && mounted();
  try {
    const result=await prepare();
    if(!current())return false;
    if(result.status!=='ready')warn('Spectral preview unavailable; using the existing VoxShift engine.');
    return true;
  }catch{
    if(!current())return false;
    warn('Spectral preview could not initialize; using the existing VoxShift engine.');
    return true;
  }finally{
    if(pending.current===attempt){
      if(!current())reset();
      pending.current=null;
    }
  }
}
