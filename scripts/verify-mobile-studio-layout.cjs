const {chromium}=require('@playwright/test');
(async()=>{
 const b=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  for(const width of [320,375,393,768]){
   const p=await b.newPage({viewport:{width,height:812},deviceScaleFactor:2,hasTouch:true,isMobile:true});
   await p.goto('http://127.0.0.1:5173/audio/nali-pcm-capture.worklet.js');
   const v=await p.evaluate(async()=>{
    document.head.innerHTML='<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css">'; document.body.innerHTML='<div id="root"></div>'; 
    document.body.style.margin='0';
    document.body.style.background='#0d0b14';
    const RefreshRuntime=await import('/@react-refresh'); RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true; const ReactModule=await import('/.vite/deps/react.js'); const React=ReactModule.default||ReactModule;
    const ReactDOMModule=await import('/.vite/deps/react-dom_client.js'); const ReactDOM=ReactDOMModule.default||ReactDOMModule;
    const {default:MobileStudioTracks}=await import('/src/components/studio/MobileStudioTracks.jsx');
    const tracks=[{id:1,name:'Lead Vocal',type:'audio',waveform:Array.from({length:2000},(_,i)=>Math.abs(Math.sin(i/19))),volume:90,armed:false},
      {id:2,name:'Backing Track',type:'audio',waveform:Array.from({length:160},(_,i)=>Math.abs(Math.sin(i/4))),volume:70,armed:false}];
    const app=React.createElement('div',{style:{width:'100vw',maxWidth:'100%',overflowX:'hidden'}},
      React.createElement(MobileStudioTracks,{lanes:tracks.map(primary=>({primary,clips:[primary]})),selectedTrackIds:[1],
      onSelect:()=>{},onArm:()=>{},onMute:()=>{},onSolo:()=>{},onVolume:()=>{},onAdd:()=>{},onImport:()=>{},onReconstruct:()=>{},onMixer:()=>{},onPolish:()=>{}}));
    ReactDOM.createRoot(document.getElementById('root')).render(app);
    await new Promise(resolve=>setTimeout(resolve,1200));
    const root=document.getElementById('root');
    return {width:window.innerWidth,docWidth:document.documentElement.scrollWidth,
      innerWidth:root.firstChild.getBoundingClientRect().width,
      buttons:[...document.querySelectorAll('button')].map(x=>({name:x.getAttribute('aria-label')||x.textContent.trim().slice(0,25),width:Math.round(x.getBoundingClientRect().width),
        height:Math.round(x.getBoundingClientRect().height),right:Math.round(x.getBoundingClientRect().right)})).filter(x=>x.right>window.innerWidth+2||x.width<30||x.height<36).slice(0,10)};
   });
   console.log('Mobile Studio viewport',JSON.stringify(v));
   if(v.docWidth>width+2||v.buttons.length)process.exitCode=2;
   await p.close();
  }
 }finally{await b.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
