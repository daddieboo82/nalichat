import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle2, Circle, ArrowLeft } from 'lucide-react';

const initial = { title:'', artist:'', collaborators:'', lyrics:'', releaseDate:'', isrc:'', upc:'', explicit:false, master:false, artwork:false, video:false, distribution:false, campaign:false };
const checklist = [
  ['master','Final master ready'], ['artwork','Cover artwork ready'], ['video','Music video / visual ready'],
  ['distribution','Distribution delivery prepared'], ['campaign','Campaign assets and rollout prepared']
];

export default function ArtistReleaseCenter(){
  const nav=useNavigate();
  const [release,setRelease]=useState(()=>{try{return {...initial,...JSON.parse(localStorage.getItem('nalichat.artistRelease.v1')||'{}')}}catch{return initial}});
  const update=(key,value)=>{const next={...release,[key]:value};setRelease(next);localStorage.setItem('nalichat.artistRelease.v1',JSON.stringify(next));};
  const readiness=useMemo(()=>Math.round(checklist.filter(([k])=>release[k]).length/checklist.length*100),[release]);
  return <div className="min-h-full overflow-y-auto bg-[#080810] px-4 pb-24 pt-6 text-white">
    <div className="mx-auto max-w-5xl space-y-5">
      <button onClick={()=>nav('/artist-career-os')} className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft size={16}/>Artist Career OS</button>
      <header className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-fuchsia-500/10 p-6">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.22em] text-cyan-300"><Rocket size={16}/> Artist Release Center</div>
        <h1 className="mt-2 text-3xl font-black">Take the record from finished to released.</h1>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400 transition-all" style={{width:readiness+'%'}}/></div>
        <p className="mt-2 text-sm font-bold text-cyan-200">{readiness}% release ready</p>
      </header>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
          <h2 className="text-lg font-black">Release metadata</h2>
          <div className="mt-4 grid gap-3">
            {[['title','Song / project title'],['artist','Artist name'],['collaborators','Collaborators & credits'],['releaseDate','Release date'],['isrc','ISRC'],['upc','UPC']].map(([key,label])=>
              <label key={key} className="text-xs font-bold text-white/60">{label}<input type={key==='releaseDate'?'date':'text'} value={release[key]} onChange={e=>update(key,e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"/></label>
            )}
            <label className="text-xs font-bold text-white/60">Lyrics<textarea rows={5} value={release.lyrics} onChange={e=>update('lyrics',e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60"/></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={release.explicit} onChange={e=>update('explicit',e.target.checked)}/> Explicit content</label>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
            <h2 className="text-lg font-black">Release readiness</h2>
            <div className="mt-3 space-y-2">{checklist.map(([key,label])=><button key={key} onClick={()=>update(key,!release[key])} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-left text-sm hover:bg-white/[.05]">{release[key]?<CheckCircle2 className="text-emerald-400" size={20}/>:<Circle className="text-white/30" size={20}/>}<span>{label}</span></button>)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={()=>nav('/studio')} className="rounded-xl bg-white/10 p-3 text-sm font-bold">Open Studio</button>
            <button onClick={()=>nav('/cover-art')} className="rounded-xl bg-white/10 p-3 text-sm font-bold">Cover Art</button>
            <button onClick={()=>nav('/music-video-generator')} className="rounded-xl bg-white/10 p-3 text-sm font-bold">Music Video</button>
            <button onClick={()=>nav('/analytics')} className="rounded-xl bg-white/10 p-3 text-sm font-bold">Analytics</button>
          </div>
        </div>
      </section>
    </div>
  </div>;
}
