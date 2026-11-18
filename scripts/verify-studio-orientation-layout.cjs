const {chromium,webkit}=require('@playwright/test');
const sizes=[[390,844],[320,568],[844,390],[667,375],[932,430],[1024,768]];
(async()=>{
 for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
   await page.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
   await page.evaluate(()=>{
    document.head.innerHTML='<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css"><link rel="stylesheet" href="/src/styles/studioMobileOrientation.css">';
    document.body.innerHTML='<div id="root"></div>';document.body.style.margin='0';
    window.__studioTestProjectName='Portrait/landscape original take';
   });
   await page.evaluate(async()=>{await import('/src/index.css');await new Promise(resolve=>setTimeout(resolve,300));});
   for(const [width,height] of sizes){
    await page.setViewportSize({width,height});
    const result=await page.evaluate(async()=>{
      const {studioMobileViewport}=await import('/src/hooks/useStudioMobileViewport.js');
      const {mobile,landscape}=studioMobileViewport(innerWidth,innerHeight);
      const root=document.getElementById('root');
      root.innerHTML='<main class="flex flex-col h-screen h-[100dvh] overflow-hidden bg-[#0D0B14] text-white relative '+(mobile?'studio-mobile-workspace studio-mobile-premium ':'')+(landscape?'studio-mobile-landscape':'')+'">'+
       '<header class="studio-mobile-topbar min-h-[4rem] py-2 mx-2 sm:mx-3 mt-2 sm:mt-3 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-2 pl-2 pr-2 shrink-0">NaliStudio · '+window.__studioTestProjectName+'</header>'+
       '<section class="studio-mobile-status mx-2 mt-2 shrink-0 rounded-xl border border-white/10 bg-[#191526] px-3 py-2" style="display:'+(mobile?'block':'none')+'"><div class="flex justify-between"><strong>Microphone is recording</strong><span class="studio-landscape-live">00:12 · Peak -9 dBFS</span></div><p>Keep this page open</p></section>'+
       '<section class="studio-mobile-recording-extended studio-mobile-capture-progress mx-2 mt-1 shrink-0 rounded-xl border border-white/10 px-3 py-2" style="display:'+(mobile?'block':'none')+'"><strong>Recording 00:12 · protected through 00:08</strong><p>Keep recording until finish</p></section>'+
       '<section class="studio-mobile-recording-extended studio-mobile-meter-panel mx-2 mt-1 shrink-0 rounded-xl border border-white/10 px-3 py-2" style="display:'+(mobile?'block':'none')+'"><strong>Live input · Peak -9 dBFS</strong><div class="mt-2 h-3 bg-emerald-500"></div><p>Input level is healthy</p><p>Monitor peaks</p></section>'+
       '<section class="studio-mobile-recording-extended studio-mobile-coach-panel mx-2 mt-1 shrink-0 rounded-xl border border-white/10 px-3 py-2" style="display:'+(mobile?'block':'none')+'"><strong>Vocal assistant</strong><p>Recording signal looks healthy.</p></section>'+
       '<nav class="studio-mobile-tabs mx-2 mt-2 flex shrink-0 gap-1 rounded-2xl border border-white/10 p-1" style="display:'+(mobile?'flex':'none')+'">'+['Record','Timeline','Tools'].map(x=>'<button aria-selected="'+(x==='Record'?'true':'false')+'" class="flex-1 min-h-11 rounded-xl bg-white/10 text-sm">'+x+'</button>').join('')+'</nav>'+
       '<section class="studio-mobile-record-view '+(landscape?'studio-mobile-record-grid ':'')+'min-h-0 flex-1 overflow-y-auto mx-2 mt-2 rounded-2xl border border-white/10 bg-[#100E19]" style="display:'+(mobile?'block':'none')+'">'+
         '<div class="studio-mobile-record-heading sticky top-0 z-10 border-b border-white/10 px-4 py-3"><p>Record anywhere</p><p>Record on your phone and finish on PC</p></div>'+
         '<div class="studio-mobile-side-pane p-3 pb-0 space-y-3"><div class="h-16 rounded-lg border border-white/10">Mic readiness</div><div class="h-24 rounded-lg border border-white/10">Review take · 1 / 2</div><button class="min-h-12 w-full rounded-xl bg-violet-800">Save for PC</button></div>'+
         '<div class="studio-mobile-tracks-pane min-h-0"><div data-testid="mobile-studio-tracks" class="flex flex-col gap-3 p-3 pb-28"><button class="min-h-11 rounded-xl bg-violet-800">Add Track</button>'+
           Array.from({length:8},(_,i)=>'<div class="rounded-xl border border-white/10 p-3"><div>Vocal '+(i+1)+'</div><button class="min-h-11 w-full">Listen and review</button></div>').join('')+'</div></div>'+
       '</section>'+
       '<section class="studio-mobile-tools-view min-h-0 flex-1 overflow-auto mx-2 mt-2 rounded-2xl border border-white/10 p-3 pb-28" style="display:none"><div class="grid grid-cols-2 gap-2">'+Array.from({length:8},(_,i)=>'<button class="min-h-12 border border-white/10">Tool '+i+'</button>').join('')+'</div></section>'+
       '<section class="studio-mobile-timeline min-h-0 flex-1 overflow-auto mx-2 mt-2 rounded-xl border border-white/10" style="display:none"><div style="width:1800px;height:450px">Timeline track headers and waveforms</div></section>'+
       '<footer aria-label="Mobile Studio transport" class="studio-mobile-transport fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#171321] px-3 pt-2" style="display:'+(mobile?'block':'none')+';padding-bottom:10px"><div class="mx-auto flex max-w-md items-center justify-between gap-2">'+['Stop','Play','Record','Save'].map(x=>'<button class="min-h-12 flex-1 rounded-xl border border-white/10">'+x+'</button>').join('')+'</div></footer>'+
      '</main>';
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const main=root.firstChild,record=main.querySelector('.studio-mobile-record-view'),tabs=main.querySelector('.studio-mobile-tabs'),
        footer=main.querySelector('.studio-mobile-transport');
      const rect=el=>el.getBoundingClientRect();
      const cols=getComputedStyle(record).gridTemplateColumns;
      const recordButtons=[...record.querySelectorAll('button')];
      const measurements={width:innerWidth,height:innerHeight,mobile,landscape,
        docWidth:document.documentElement.scrollWidth,recordDisplay:getComputedStyle(record).display,
        recordHeight:Math.round(rect(record).height),recordWidth:Math.round(rect(record).width),gridCols:cols,
        leftScroll:main.querySelector('.studio-mobile-side-pane').scrollHeight>main.querySelector('.studio-mobile-side-pane').clientHeight,
        rightScroll:main.querySelector('.studio-mobile-tracks-pane').scrollHeight>main.querySelector('.studio-mobile-tracks-pane').clientHeight,
        footerVisible:getComputedStyle(footer).display!=='none',
        transportHeight:Math.round(rect(footer).height),
        tabsHeight:Math.round(rect(tabs).height),
        headerBottom:Math.round(rect(main.querySelector('.studio-mobile-topbar')).bottom),
        recordTop:Math.round(rect(record).top),footerTop:Math.round(rect(footer).top),
        minButtonHeight:Math.min(...[...footer.querySelectorAll('button'),...tabs.querySelectorAll('button')].map(el=>rect(el).height)),
        sideWidth:Math.round(rect(main.querySelector('.studio-mobile-side-pane')).width),
        tracksWidth:Math.round(rect(main.querySelector('.studio-mobile-tracks-pane')).width),
        projectRetained:main.querySelector('header').textContent.includes(window.__studioTestProjectName),
        tabsSelectedGradient:getComputedStyle(tabs.querySelector('button')).backgroundImage.includes('gradient'),
        portraitTracksFirst: !landscape && mobile ? Number.parseInt(getComputedStyle(main.querySelector('.studio-mobile-tracks-pane')).order) < Number.parseInt(getComputedStyle(main.querySelector('.studio-mobile-side-pane')).order) : null,
      };
      if(mobile){
        const tools=main.querySelector('.studio-mobile-tools-view');
        const timeline=main.querySelector('.studio-mobile-timeline');
        record.style.display='none';tools.style.display='block';
        measurements.toolsHeight=Math.round(rect(tools).height);
        measurements.toolsColumns=getComputedStyle(tools.querySelector('.grid-cols-2')).gridTemplateColumns.split(' ').length;
        tools.style.display='none';timeline.style.display='block';
        measurements.timelineHeight=Math.round(rect(timeline).height);
        measurements.timelineScrollable=timeline.scrollWidth>timeline.clientWidth;
        measurements.footerAfterTabs=getComputedStyle(footer).display!=='none';
      }
      return measurements;
    });
    console.log(engineName,JSON.stringify(result));
    if(result.mobile){
      if(result.docWidth>width+2 || result.recordHeight<90 || result.recordTop>=result.footerTop ||
         result.toolsHeight<80 || result.timelineHeight<80 || !result.timelineScrollable || !result.footerAfterTabs ||
         result.minButtonHeight<43 || !result.footerVisible || !result.projectRetained || !result.tabsSelectedGradient || (result.landscape===false && !result.portraitTracksFirst))
         throw Error(engineName+': invalid mobile controls '+JSON.stringify(result));
      if(result.landscape && (result.recordDisplay!=='grid'||result.sideWidth<205||result.tracksWidth<250||result.toolsColumns!==4||
        !result.leftScroll||!result.rightScroll)) throw Error(engineName+': bad landscape panes '+JSON.stringify(result));
    } else if(result.landscape||result.footerVisible)throw Error('Desktop mode incorrectly treated as phone');
   }
   await page.close();
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
