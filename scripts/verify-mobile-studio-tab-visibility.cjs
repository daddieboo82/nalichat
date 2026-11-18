const {chromium,webkit}=require('@playwright/test');
(async()=>{
 for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
    await page.evaluate(async()=>{
      document.head.innerHTML='<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/styles/studioMobileOrientation.css">';
      document.body.innerHTML='<div id="root"></div>';
      await import('/src/index.css');
    });
    for(const [width,height] of [[390,844],[320,568],[844,390],[667,375]]){
      await page.setViewportSize({width,height});
      const result=await page.evaluate(async()=>{
        const {studioMobileViewport}=await import('/src/hooks/useStudioMobileViewport.js');
        const {mobile,landscape}=studioMobileViewport(innerWidth,innerHeight);
        const root=document.getElementById('root');
        root.innerHTML='<main class="studio-mobile-workspace studio-mobile-premium '+(landscape?'studio-mobile-landscape':'')+' flex flex-col h-[100dvh] overflow-hidden">'+
          '<div class="studio-mobile-topbar shrink-0 h-10">Nali Studio</div>'+
          '<nav class="studio-mobile-tabs flex shrink-0 gap-1">'+['Record','Timeline','Tools'].map(label=>'<button class="min-h-11 flex-1" type="button" data-tab="'+label.toLowerCase()+'">'+label+'</button>').join('')+'</nav>'+
          '<section class="studio-mobile-record-view flex-1 min-h-0" data-panel="record"><div class="studio-mobile-record-heading">The Vocal Room</div><div class="studio-mobile-side-pane">Setup and review</div><div class="studio-mobile-tracks-pane">Tracks</div></section>'+
          '<section class="studio-mobile-timeline flex-1 min-h-0" data-panel="timeline"><div>Waveform Timeline</div></section>'+
          '<section class="studio-mobile-tools-view flex-1 min-h-0" data-panel="tools"><div>Studio Tools</div></section>'+
          '<footer class="studio-mobile-transport fixed bottom-0 left-0 right-0"><button class="min-h-12">Record</button></footer></main>';
        const main=root.firstChild,panels=[...main.querySelectorAll('[data-panel]')];
        function select(name){
          for(const el of panels){
            const active=el.dataset.panel===name;
            el.style.display=active?'block':'none';
            el.classList.toggle('studio-mobile-record-active',active&&name==='record');
            el.classList.toggle('studio-mobile-record-grid',active&&name==='record'&&landscape);
          }
          for(const btn of main.querySelectorAll('[data-tab]'))btn.setAttribute('aria-selected',String(btn.dataset.tab===name));
          const visible=panels.filter(el=>getComputedStyle(el).display!=='none');
          if(visible.length!==1||visible[0].dataset.panel!==name)throw new Error('tab mismatch '+name+': '+visible.map(x=>x.dataset.panel));
          if(name==='record' && getComputedStyle(panels[0]).display !==(landscape?'grid':'flex'))throw new Error('record geometry changed');
          const rect=visible[0].getBoundingClientRect();
          if(rect.width<260||rect.height<40)throw new Error('tab workspace collapsed '+name+' '+rect.height);
          return {name,display:getComputedStyle(visible[0]).display,height:Math.round(rect.height)};
        }
        const transitions=['record','timeline','tools','record','tools'].map(select);
        return {width:innerWidth,height:innerHeight,transitions};
      });
      console.log(engineName,JSON.stringify(result));
    }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
