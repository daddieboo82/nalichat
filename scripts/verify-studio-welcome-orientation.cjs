const {chromium,webkit}=require('@playwright/test');
(async()=>{
 for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
   await page.evaluate(async()=>{
     document.head.innerHTML='<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/styles/studioMobileOrientation.css">';
     document.body.innerHTML='<div id="root"></div>';
     await import('/src/index.css');
   });
   for(const [width,height] of [[390,844],[844,390],[667,375]]){
    await page.setViewportSize({width,height});
    const data=await page.evaluate(async()=>{
      const root=document.getElementById('root');
      root.innerHTML='<div class="studio-mobile-welcome relative flex min-h-screen min-h-[100dvh] flex-1 flex-col items-center justify-center overflow-y-auto bg-background px-4 pt-4 pb-4 sm:p-8"><div class="studio-mobile-welcome-card ui-surface z-10 flex w-full max-w-lg flex-col items-center rounded-3xl border border-border/80 bg-card/80 p-5 sm:p-8"><div class="studio-mobile-welcome-icon mb-5 flex h-16 w-16 rounded-2xl">Mic</div><h1 class="mb-2 text-center text-2xl">Welcome to Studio</h1><p class="studio-mobile-welcome-description mb-7 max-w-sm text-center text-sm">Record anywhere on your phone or tablet.</p><div class="studio-mobile-welcome-actions flex flex-col gap-3 w-full">'+['Create New Project','Pick Up Where I Left Off','Browse My Studio Sessions','Restore Backup from Device','Load Demo Project'].map(t=>'<button class="min-h-14 w-full rounded-xl border border-border/80">'+t+'</button>').join('')+'<div class="mt-4 pt-4 border-t"><button class="min-h-11">Back to Dashboard</button></div></div></div></div>';
      await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      const card=root.querySelector('.studio-mobile-welcome-card'),
        actions=root.querySelector('.studio-mobile-welcome-actions'),
        buttons=[...actions.querySelectorAll(':scope > button')];
      return {width:innerWidth,height:innerHeight,
        docWidth:document.documentElement.scrollWidth,
        cardHeight:Math.round(card.getBoundingClientRect().height),
        columns:getComputedStyle(actions).gridTemplateColumns.split(' ').length,
        lastButtonBottom:Math.round(buttons.at(-1).getBoundingClientRect().bottom),
        firstButtonHeight:Math.round(buttons[0].getBoundingClientRect().height)};
    });
    console.log(name,JSON.stringify(data));
    if(data.docWidth>width+2||data.firstButtonHeight<44)throw Error('Welcome touch/layout failure');
    if(width>height && (data.columns!==2||data.lastButtonBottom>height+2))throw Error('Landscape welcome overflows viewport');
   }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
