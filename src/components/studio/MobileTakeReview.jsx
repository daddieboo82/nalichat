import React from 'react';
import { Headphones, Mic2, Monitor, Pause, Play, ShieldCheck } from 'lucide-react';

export default function MobileTakeReview({
  track, comparisonTakes = [], onChooseTake, onTogglePlayback, playing = false,
  onRetake, onSaveForPC, recording = false, saving = false, readOnly = false,
}) {
  const url = track?.audioUrl || track?.file_url;
  if (!track || !url) return null;
  const quality = track.captureQuality;
  const isTemporary = typeof url === 'string' && url.startsWith('blob:');
  const state = quality?.status;
  const recommendation = state === 'clipping'
    ? 'Possible clipping in this take. Listen for distortion. A new take may be cleaner.'
    : state === 'quiet' || state === 'silent'
      ? 'This take may be too quiet. Check microphone placement before another take.'
      : state === 'good'
        ? 'Recorded levels look healthy. Listen for the performance, room noise, and pronunciation.'
        : 'Automatic quality measurements are unavailable for this take. Listen before deciding.';
  return <section aria-label="Review recorded take" className="rounded-2xl border border-primary/25 bg-studio-raised p-3 space-y-3" data-testid="mobile-take-review">
    <div className="flex items-start gap-2">
      <Headphones className="mt-1 h-5 w-5 text-primary"/>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">Review this take</h3>
        <p className="truncate text-xs text-muted-foreground">{track.name || 'Vocal recording'}</p>
      </div>
    </div>
    {comparisonTakes.length > 1 && <div className="space-y-1" aria-label="Compare vocal takes">
      <p className="text-xs font-semibold">Compare performances · {comparisonTakes.length} takes</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {comparisonTakes.map((take,index)=><button key={take.id} type="button"
          aria-pressed={String(track.id)===String(take.id)}
          aria-label={`Select take ${index+1}: ${take.name}`}
          onClick={()=>onChooseTake?.(take.id)}
          className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs font-semibold ${String(track.id)===String(take.id)?'border-primary bg-primary/15 text-primary':'border-white/20 bg-white/5 text-muted-foreground'}`}>
          Take {index+1}{take.quality?.status==='clipping'?' · Possible clipping':''}
        </button>)}
      </div>
      <p className="text-[11px] text-muted-foreground">Select a take to hear it on its own. Stop playback to return to the full mix.</p>
    </div>}
    <button type="button" disabled={recording} onClick={() => onTogglePlayback(track)}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 text-sm font-semibold disabled:opacity-40">
      {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
      {playing ? 'Pause timeline' : 'Play from this take'}
    </button>
    <p className="text-xs text-muted-foreground">{recommendation}</p>
    {quality && Number.isFinite(quality.peakDb) && <p className="text-[11px] text-muted-foreground">
      Peak {quality.peakDb.toFixed(1)} dBFS · RMS {Number.isFinite(quality.rmsDb) ? quality.rmsDb.toFixed(1) : 'unknown'} dBFS
    </p>}
    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <ShieldCheck className="h-3.5 w-3.5"/>
      {isTemporary ? 'This audio is still in this browser. Save it before leaving.' :
        'This take uses a saved or imported audio link. Unsaved edits may still need saving.'}
    </p>
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className="min-h-12 rounded-xl border border-white/20 bg-white/5 px-2 text-xs font-semibold disabled:opacity-40"
        disabled={readOnly || recording || saving}
        onClick={()=>onRetake(track)} aria-label="Prepare another take, keeping original">
        <Mic2 className="mr-1 inline h-4 w-4"/>New take
      </button>
      <button type="button" className="min-h-12 rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        disabled={readOnly || recording || saving} onClick={onSaveForPC} aria-label="Save reviewed take for PC">
        <Monitor className="mr-1 inline h-4 w-4"/>{saving?'Saving…':'Save for PC'}
      </button>
    </div>
    <p className="text-[11px] text-muted-foreground">New take prepares recording without deleting this audio. Press Record below when ready. Review and cloud save are separate steps.</p>
  </section>;
}