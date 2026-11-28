// One outstanding reset per processor. Reject superseded or disposed requests.
export function createVoxResetHandshake(port,{timeoutMs=1000}={}) {
  let sequence=0,pending=null,closed=false;
  const finish=(error)=>{if(!pending)return;const p=pending;pending=null;clearTimeout(p.timer);error?p.reject(error):p.resolve();};
  const onMessage=({data})=>{if(data?.type==='reset-complete'&&pending?.id===data.id)finish();};
  port.addEventListener('message',onMessage);port.start();
  return {reset(){if(closed)return Promise.reject(Error('Processor disposed'));finish(Error('Reset superseded'));return new Promise((resolve,reject)=>{const id=++sequence;pending={id,resolve,reject,timer:setTimeout(()=>finish(Error('Spectral reset timed out')),timeoutMs)};try{port.postMessage({type:'reset',id});}catch(error){finish(error);}});},dispose(){if(closed)return;closed=true;finish(Error('Processor disposed'));port.removeEventListener('message',onMessage);}};
}
