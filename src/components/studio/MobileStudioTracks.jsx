import React from 'react';
import { Mic, VolumeX, Headphones, Plus, AudioLines, SlidersHorizontal, Upload, Wand2, PlayCircle, CheckCircle2 } from 'lucide-react';
import TrackWaveformSVG from './TrackWaveformSVG';
import { cn } from '@/lib/utils';

export function mobilePreviewWaveform(values, maxPoints = 160) {
  if (!Array.isArray(values) || values.length <= maxPoints) return values || [];
  return Array.from({ length: maxPoints }, (_, index) => values[Math.floor(index * values.length / maxPoints)] || 0);
}

// Phone-first track cards: no 2,000px timeline and no precision drag handles
// required to arm a microphone, select a vocal, or adjust its volume.
// The full desktop timeline remains reachable through the Timeline tab.
export default function MobileStudioTracks({
  lanes = [], selectedTrackIds = [], onSelect, onArm, onMute, onSolo,
  onVolume, onAdd, onImport, onReconstruct, onMixer, onPolish, onReview,
  autoPolish = false, readOnly = false,
}) {
  return (
    <section className="studio-mobile-track-list flex flex-col gap-3 p-3 pb-28" aria-label="Mobile Studio tracks" data-testid="mobile-studio-tracks">
      <div className="studio-mobile-track-heading flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-base text-foreground">Tracks <span className="studio-track-count ml-1 align-middle text-[11px] tabular-nums">{lanes.length}</span></h2>
          <p className="text-xs text-muted-foreground">Select a lane · arm to record</p>
        </div>
        <button type="button" onClick={onAdd} disabled={readOnly}
          className="min-h-11 shrink-0 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          aria-label="Add audio track"><Plus className="mr-1 inline h-4 w-4" />Track</button>
      </div>
      <div className="studio-mobile-quick-actions grid grid-cols-2 gap-2">
        <button type="button" onClick={onImport} disabled={readOnly}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-secondary/40 text-xs font-medium disabled:opacity-40"><Upload className="h-4 w-4" />Import audio</button>
        <button type="button" onClick={onMixer}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-secondary/40 text-xs font-medium"><SlidersHorizontal className="h-4 w-4" />Mixer</button>
        <button type="button" onClick={onPolish} aria-pressed={autoPolish} disabled={readOnly}
          className={cn('flex min-h-11 items-center justify-center gap-2 rounded-xl border text-xs font-medium disabled:opacity-40', autoPolish ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60 bg-secondary/40')}>
          <Wand2 className="h-4 w-4" />Polish {autoPolish ? 'On' : 'Off'}
        </button>
        <button type="button" onClick={onReconstruct} disabled={readOnly}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 text-xs font-medium text-violet-300 disabled:opacity-40"><AudioLines className="h-4 w-4" />AI Vocal</button>
      </div>
      {lanes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <Mic className="mx-auto mb-3 h-7 w-7 text-primary" />
          <p className="font-medium">Ready to record</p>
          <p className="mt-1 text-xs text-muted-foreground">Add a track, tap Arm, then press Record below.</p>
        </div>
      )}
      {lanes.map(({ primary: track, clips }) => {
        const selected = clips.some(clip => selectedTrackIds.some(id => String(id) === String(clip.id))) ||
          selectedTrackIds.some(id => String(id) === String(track.id));
        const audio = clips.find(c => c.audioUrl || c.file_url) || track;
        const canRecord = !readOnly && !['folder', 'vca'].includes(track.trackType) &&
          !['midi', 'instrument'].includes(track.type);
        return (
          <div key={track.id} className={cn('studio-mobile-track-card studio-cubasis-lane rounded-2xl border bg-studio-raised p-3 shadow-md', selected ? 'studio-mobile-track-selected border-primary ring-1 ring-primary/50' : 'border-foreground/10', track.armed && 'studio-mobile-track-armed')}
            data-testid={`mobile-track-${track.id}`}>
            <button type="button" onClick={() => onSelect(track.id)} aria-pressed={selected}
              className="studio-cubasis-lane-header flex min-h-11 w-full items-center justify-between gap-2 text-left">
              <span className="flex min-w-0 items-center gap-2 truncate font-medium text-foreground"><span className="studio-track-color-dot shrink-0" aria-hidden="true"/>{track.name || 'Audio track'}</span>
              <span className="studio-track-type shrink-0 text-[10px] text-muted-foreground">{selected && <CheckCircle2 className="mr-1 inline h-3 w-3"/>}{track.armed ? "REC READY" : track.type || "audio"}</span>
            </button>
            <button type="button" onClick={() => onSelect(track.id)} aria-label={`Select ${track.name || 'track'} waveform`}
              className="studio-mobile-waveform studio-cubasis-lane-waveform relative mb-3 block h-16 w-full overflow-hidden rounded-lg border border-white/10 bg-black/35">
              {audio.waveform?.length ? <TrackWaveformSVG track={{ ...audio, waveform: mobilePreviewWaveform(audio.waveform) }} /> :
                <span className="flex h-full items-center justify-center text-xs text-muted-foreground">{audio.audioUrl || audio.file_url ? 'Audio ready · view timeline' : 'No audio recorded yet'}</span>}
            </button>
            <div className="studio-mobile-track-controls grid grid-cols-3 gap-2">
              <button type="button" onClick={() => onArm(track.id)} disabled={!canRecord}
                aria-label={`Arm ${track.name || 'track'} for recording`} aria-pressed={Boolean(track.armed)}
                className={cn('min-h-11 rounded-xl border text-xs font-semibold disabled:opacity-30', track.armed ? 'border-red-500 bg-red-500/20 text-red-300' : 'border-border/60 bg-secondary/40')}>
                <Mic className="mr-1 inline h-4 w-4" />{track.armed ? 'Armed' : 'Arm'}
              </button>
              <button type="button" onClick={() => onMute(track.id)} disabled={readOnly}
                aria-label={`Mute ${track.name || 'track'}`} aria-pressed={Boolean(track.muted)}
                className={cn('min-h-11 rounded-xl border text-xs disabled:opacity-30', track.muted ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-border/60 bg-secondary/40')}>
                <VolumeX className="mr-1 inline h-4 w-4" />Mute
              </button>
              <button type="button" onClick={() => onSolo(track.id)} disabled={readOnly}
                aria-label={`Solo ${track.name || 'track'}`} aria-pressed={Boolean(track.solo)}
                className={cn('min-h-11 rounded-xl border text-xs disabled:opacity-30', track.solo ? 'border-primary bg-primary/15 text-primary' : 'border-border/60 bg-secondary/40')}>
                <Headphones className="mr-1 inline h-4 w-4" />Solo
              </button>
            </div>
            {(audio.audioUrl || audio.file_url) && <button type="button"
              onClick={() => onReview?.(audio.id)} aria-label={`Review ${audio.name || 'recorded track'}`}
              className="studio-mobile-review-button mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-xs font-semibold text-primary">
              <PlayCircle className="h-4 w-4"/>Listen & review take
            </button>}
            <label className="studio-cubasis-lane-volume mt-3 flex min-h-9 items-center gap-3 text-xs text-muted-foreground">
              <span className="w-12 shrink-0">Volume</span>
              <input type="range" min="0" max="100" step="1" value={Math.min(100, Math.max(0, Number(track.volume ?? 100)))}
                disabled={readOnly} onChange={event => onVolume(track.id, [Number(event.target.value)])}
                aria-label={`Volume for ${track.name || 'track'}`}
                className="min-w-0 flex-1 accent-primary" />
              <span className="w-9 text-right tabular-nums">{Math.round(Number(track.volume ?? 100))}%</span>
            </label>
          </div>
        );
      })}
    </section>
  );
}