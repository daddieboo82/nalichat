import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ArrowLeft } from 'lucide-react';

const initial = { title:'', artist:'', collaborators:'', lyrics:'', releaseDate:'', isrc:'', upc:'', explicit:false, master:false, artwork:false, video:false, distribution:false, campaign:false };
const checklist = [['master','Final master ready'],['artwork','Cover artwork ready'],['video','Music video / visual ready'],['distribution','Distribution delivery prepared'],['campaign','Campaign assets and rollout prepared']];

export default function ArtistReleaseCenter(){
  const nav=useNavigate();
  const [release,setRelease]=useState(()=>{try{return {...initial,...JSON.parse(localStorage.getItem('nalichat.artistRelease.v1')||'{}')}}catch{return initial}});
  const update=(key,value)=>{const next={...release,[key]:value};setRelease(next);try{localStorage.setItem('nalichat.artistRelease.v1',JSON.stringify(next));}catch{}};
  const readiness=useMemo(()=>Math.round(checklist.filter(([k])=>release[k]).length/checklist.length*100),[release]);
  return <div className="min-h-full overflow-y-auto bg-background px-4 pb-24 pt-6 text-foreground"><div className="mx-auto max-w-5xl space-y-5">
    <button onClick={()=>nav('/artist-career-os')} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={16}/>Artist Career OS</button>
    <header className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-accent/15 via-card/60 to-primary/10 p-6">
      <h1 className="font-heading text-3xl font-black tracking-tight">Release Center</h1><p className="mt-1 text-sm text-muted-foreground">Prepare release details and track what’s ready.</p>
      <div role="progressbar" aria-label="Release readiness" aria-valuenow={readiness} className="mt-5 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-gradient-to-r from-primary to-accent" style={{width:readiness+'%'}}/></div><p className="mt-2 text-sm font-bold text-accent">{readiness}% release ready</p>
    </header>
    <section className="grid gap-4 lg:grid-cols-2"><div className="ui-surface rounded-2xl p-5"><h2 className="font-heading text-lg font-black">Release details</h2><div className="mt-4 grid gap-3">
      {[['title','Song / project title'],['artist','Artist name'],['collaborators','Collaborators & credits'],['releaseDate','Release date'],['isrc','ISRC'],['upc','UPC']].map(([key,label])=><label key={key} className="text-xs font-bold text-muted-foreground">{label}<input type={key==='releaseDate'?'date':'text'} value={release[key]} onChange={e=>update(key,e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border/70 bg-secondary/40 px-3 py-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"/></label>)}
      <label className="text-xs font-bold text-muted-foreground">Lyrics<textarea rows={5} value={release.lyrics} onChange={e=>update('lyrics',e.target.value)} className="mt-1 w-full rounded-xl border border-border/70 bg-secondary/40 px-3 py-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"/></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={release.explicit} onChange={e=>update('explicit',e.target.checked)}/> Explicit content</label>
    </div></div><div className="space-y-4"><div className="ui-surface rounded-2xl p-5"><h2 className="font-heading text-lg font-black">Release checklist</h2><div className="mt-3 space-y-2">{checklist.map(([key,label])=><button key={key} type="button" aria-pressed={Boolean(release[key])} onClick={()=>update(key,!release[key])} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3 text-left text-sm transition-colors hover:border-primary/40">{release[key]?<CheckCircle2 className="text-primary" size={20}/>:<Circle className="text-muted-foreground" size={20}/>}<span>{label}</span></button>)}</div></div>
      <div className="grid grid-cols-2 gap-2"><button onClick={()=>nav('/studio')} className="min-h-12 rounded-xl border border-border/70 bg-secondary/40 p-3 text-sm font-bold transition-colors hover:border-primary/40">Open Studio</button><button onClick={()=>nav('/cover-art')} className="min-h-12 rounded-xl border border-border/70 bg-secondary/40 p-3 text-sm font-bold transition-colors hover:border-primary/40">Cover Art</button><button onClick={()=>nav('/music-video-generator')} className="min-h-12 rounded-xl border border-border/70 bg-secondary/40 p-3 text-sm font-bold transition-colors hover:border-primary/40">Music Video</button><button onClick={()=>nav('/analytics')} className="min-h-12 rounded-xl border border-border/70 bg-secondary/40 p-3 text-sm font-bold transition-colors hover:border-primary/40">Analytics</button></div>
    </div></section>
  </div></div>;
}