const {chromium,webkit,devices}=require('@playwright/test');
(async()=>{
  for(const [engine,name,device] of [[chromium,'android-chromium',devices['Pixel 5']],[webkit,'iphone-webkit',devices['iPhone 15']]]){
    const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
    try{
      const page=await browser.newPage(device);
      await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
      const result=await page.evaluate(async()=>{
        const {saveStudioRecoveryTake,getStudioRecoveryTake,deleteStudioRecoveryTake}=await import('/src/lib/studioTakeRecovery.js');
        const {studioRecoveryStorageHealth}=await import('/src/lib/studioRecoveryStorageHealth.js');
        const ownerId='storage-safety-test',scope='draft',id='quota-test-take-001';
        const audio=new Blob([new Uint8Array(5000).fill(17)],{type:'audio/wav'});
        await saveStudioRecoveryTake({ownerId,scope,id,audio,duration:1});
        const previous=await getStudioRecoveryTake(ownerId,scope,id);
        const storage=globalThis.navigator.storage;
        const original=storage?.estimate?.bind(storage);
        if(!storage || !original)throw new Error('Storage estimate unavailable in simulated browser');
        storage.estimate=async()=>({quota:10*1024*1024,usage:9*1024*1024});
        const health=await studioRecoveryStorageHealth({expectedAdditionalBytes:10000});
        let rejected=false,reason='';
        try{
          await saveStudioRecoveryTake({ownerId,scope,id,
            audio:new Blob([new Uint8Array(12000)],{type:'audio/wav'}),
            duration:2,replaceExisting:true});
        }catch(error){rejected=true;reason=error.name;}
        storage.estimate=original;
        const retained=await getStudioRecoveryTake(ownerId,scope,id);
        await deleteStudioRecoveryTake(ownerId,scope,id);
        return {health:health.level,rejected,reason,previousBytes:previous.audio.size,retainedBytes:retained.audio.size};
      });
      console.log('Mobile storage quota check',name,JSON.stringify(result));
      if(!result.rejected||result.reason!=='QuotaExceededError'||
        result.retainedBytes!==result.previousBytes||result.health!=='critical')throw Error('Low-storage fallback failed');
      await page.close();
    }finally{await browser.close();}
  }
})().catch(error=>{console.error(error);process.exitCode=1});
