const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] });
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
    const owner = 'user-verified-a';
    const scope = 'draft';
    const saved = await page.evaluate(async ({owner,scope}) => {
      const recovery = await import('/src/lib/studioTakeRecovery.js');
      const audio = new Blob([new Uint8Array([1,4,8,9,0,6])], {type:'audio/wav'});
      return recovery.saveStudioRecoveryTake({ownerId:owner,scope,audio,duration:2.4,name:'Mobile Lead',startTime:0});
    },{owner,scope});
    await page.reload();
    const afterReload = await page.evaluate(async ({owner,scope,id}) => {
      const recovery = await import('/src/lib/studioTakeRecovery.js');
      const visible = await recovery.listStudioRecoveryTakes(owner,scope);
      const wrongUser = await recovery.listStudioRecoveryTakes('user-verified-b',scope);
      const wrongRoom = await recovery.listStudioRecoveryTakes(owner,'room:other-room-id');
      const record = await recovery.getStudioRecoveryTake(owner,scope,id);
      const bytes = [...new Uint8Array(await record.audio.arrayBuffer())];
      let denied = false;
      try { await recovery.getStudioRecoveryTake('user-verified-b',scope,id); }
      catch { denied = true; }
      await recovery.deleteStudioRecoveryTake(owner,scope,id);
      const remaining = await recovery.listStudioRecoveryTakes(owner,scope);
      return { visible:visible.length, wrongUser:wrongUser.length, wrongRoom:wrongRoom.length,
        bytes, denied, remaining:remaining.length };
    },{owner,scope,id:saved.id});
    console.log('NaliChat mobile device recovery:', JSON.stringify(afterReload));
    if(afterReload.visible !== 1 || afterReload.wrongUser !== 0 || afterReload.wrongRoom !== 0 ||
       afterReload.bytes.join(',') !== '1,4,8,9,0,6' || !afterReload.denied || afterReload.remaining !== 0) {
      throw new Error('Mobile recovery isolation/reload test failed');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
