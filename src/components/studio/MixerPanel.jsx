import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Square, Settings2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countActiveEffects, getTrackEffects } from '@/lib/audioProcessing';

// A lane may contain multiple split clips, each with its own live strip.
export function readStudioLanePeak(engine, clips) {
  let peak = null;
  for (const clip of clips || []) {
    const value = engine?.readTrackPeak?.(clip.id);
    if (Number.isFinite(value) && value >= 0) peak = Math.max(peak ?? 0, value);
  }
  return peak;
}

function ChannelPeakMeter({ track, isPlaying, mixEngineRef }) {
  const [level, setLevel] = useState(null);
  const [held, setHeld] = useState(0);
  const [clipped, setClipped] = useState(false);
  const clipsRef = useRef(track.laneClips?.length ? track.laneClips : [track]);
  clipsRef.current = track.laneClips?.length ? track.laneClips : [track];
  useEffect(() => {
    if (!isPlaying) { setLevel(null); return; }
    const tick = () => {
      const peak = readStudioLanePeak(mixEngineRef?.current, clipsRef.current);
      setLevel(peak);
      if (peak !== null) {
        setHeld(previous => Math.max(previous, peak));
        if (peak >= 1) setClipped(true);
      }
    };
    tick();
    const timer = setInterval(tick, 50);
    return () => clearInterval(timer);
  }, [isPlaying, mixEngineRef, track.id]);
  const pct = peak => peak > 0 ? Math.max(0, Math.min(100, (20 * Math.log10(peak) + 60) / 60 * 100)) : 0;
  return (
    <div className="flex flex-col items-center h-full gap-1" aria-label={track.name + " channel peak meter"}>
      <button type="button" onClick={() => { setClipped(false); setHeld(0); }}
        title="Reset sampled channel peak and clipping indicator"
        className={cn("text-[8px] font-bold rounded px-1", clipped ? "bg-red-600 text-white" : "text-muted-foreground")}>
        {clipped ? "CLIP" : "PK"}
      </button>
      <div className="w-2 flex-1 min-h-0 bg-studio-bg rounded overflow-hidden flex flex-col justify-end relative">
        <div className={cn("w-full", level >= 1 ? "bg-red-500" : level >= 0.501187 ? "bg-yellow-400" : "bg-green-500")} style={{height: pct(level) + "%"}} />
        {held > 0 && <div className="absolute left-0 right-0 h-0.5 bg-foreground/70 pointer-events-none" style={{bottom: Math.min(99, pct(held)) + "%"}} />}
      </div>
      <span className="text-[8px] font-mono">{level === null ? "—" : level > 0 ? (20 * Math.log10(level)).toFixed(1) : "−∞"}</span>
    </div>
  );
}

// Actual post-fader stereo sample peaks. Unavailable routing is not silence.
function MasterPeakMeter({ mixEngineRef, isPlaying }) {
  const [peaks, setPeaks] = useState(null);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    if (!isPlaying) { setPeaks(null); return; }
    const tick = () => {
      const next = mixEngineRef?.current?.readMasterPeaks?.() ?? null;
      setPeaks(next);
      if (next?.some(peak => peak >= 1)) setClipped(true);
    };
    tick();
    const timer = setInterval(tick, 50);
    return () => clearInterval(timer);
  }, [isPlaying, mixEngineRef]);
  return (
    <div className="flex flex-col items-center gap-1 h-full" aria-label="Master stereo sample peak meter">
      <button type="button" onClick={() => setClipped(false)}
        title="Reset sampled clipping indicator"
        className={cn("text-[8px] font-bold rounded px-1", clipped ? "bg-red-600 text-white" : "text-muted-foreground")}>
        {clipped ? "CLIP" : "PEAK"}
      </button>
      <div className="flex gap-1 flex-1 min-h-0">
        {[0,1].map(channel => {
          const peak = peaks?.[channel] || 0;
          const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
          const height = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
          return <div key={channel} className="flex flex-col items-center h-full gap-0.5">
            <div className="w-2 flex-1 min-h-0 bg-studio-bg rounded overflow-hidden flex flex-col justify-end">
              <div className={cn("w-full", db >= 0 ? "bg-red-500" : db >= -6 ? "bg-yellow-400" : "bg-green-500")} style={{height: height + "%"}} />
            </div>
            <span className="text-[8px]">{channel === 0 ? "L" : "R"}</span>
            <span className="text-[8px] font-mono">{!peaks ? "—" : peak > 0 ? db.toFixed(1) : "−∞"}</span>
          </div>;
        })}
      </div>
    </div>
  );
}

export default function MixerPanel({
  show,
  onClose,
  tracks,
  masterVolume,
  setMasterVolume,
  updateVolume,
  toggleMute,
  toggleSolo,
  onOpenFX,
  onOpenMasterFX,
  onCommitTrack,
  masterFx,
  fxTarget,
  updateTrack,
  isPlaying,
  currentTimeRef,
  mixEngineRef,
}) {
  useEffect(() => {
    if (!show || !isPlaying) mixEngineRef?.current?.releaseTrackMeters?.();
    return () => { mixEngineRef?.current?.releaseTrackMeters?.(); };
  }, [show, isPlaying, mixEngineRef]);
  const commit = () => onCommitTrack?.();
  const masterFxCount = countActiveEffects(masterFx);
  const soloActive = (tracks || []).some(t => t.solo);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 320, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-foreground/10 bg-studio-header/95 backdrop-blur shrink-0 flex overflow-x-auto custom-scrollbar relative w-full"
        >
          <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
            <span className="text-xs font-bold text-muted-foreground mr-2">MIXER & FX</span>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close mixer" title="Close mixer" className="w-6 h-6 rounded-full"><Square className="w-3 h-3" /></Button>
          </div>

          <div className="flex sm:flex-nowrap p-4 gap-3 pt-8 pb-4 h-full items-end w-max min-w-full">
            {tracks.map(track => {
              const fxCount = countActiveEffects(getTrackEffects(track));
              const sendLevel = Math.max(0, Math.min(100, track.send1 || 0));
              const send2Level = Math.max(0, Math.min(100, track.send2 || 0));
              const send3Level = Math.max(0, Math.min(100, track.send3 || 0));
              const isFxOpen = fxTarget === track.id;
              return (
              <div key={track.id} className="w-36 h-full bg-studio-surface/70 border border-foreground/10 rounded-lg p-2.5 flex flex-col justify-between shrink-0 shadow-sm relative">
                <div className="text-[10px] text-center font-bold text-foreground/90 truncate w-full mb-1" title={track.name}>{track.name}</div>

                {/* Sends Routing */}
                <div className="flex flex-col gap-1 w-full bg-studio-bg/70 p-1.5 rounded-md border border-foreground/10 mb-1">
                  <div className="text-[8px] text-muted-foreground font-semibold flex justify-between">
                    <span className={cn(sendLevel > 0 && 'text-primary/90')}>Send 1 (Rev)</span>
                    <span className="font-mono text-[8px] text-primary/80">{sendLevel}%</span>
                  </div>
                  <Slider
                    value={[sendLevel]}
                    max={100}
                    aria-label={`Send 1 reverb level for ${track.name}`}
                    onValueChange={(val) => updateTrack(track.id, { send1: val[0] })}
                    onValueCommit={commit}
                    className="w-full [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5 [&_[role=slider]]:bg-primary/80"
                  />
                  <div className="text-[8px] text-muted-foreground font-semibold flex justify-between mt-1">
                    <span className={cn(send2Level > 0 && 'text-primary/90')}>Send 2 (Delay)</span>
                    <span className="font-mono text-[8px] text-primary/80">{send2Level}%</span>
                  </div>
                  <Slider value={[send2Level]} max={100} aria-label={`Send 2 delay level for ${track.name}`} onValueChange={(val) => updateTrack(track.id, { send2: val[0] })} onValueCommit={commit} className="w-full [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5" />
                  <div className="text-[8px] text-muted-foreground font-semibold flex justify-between mt-1">
                    <span className={cn(send3Level > 0 && 'text-primary/90')}>Send 3 (Cue)</span>
                    <span className="font-mono text-[8px] text-primary/80">{send3Level}%</span>
                  </div>
                  <Slider value={[send3Level]} max={100} aria-label={`Send 3 cue level for ${track.name}`} onValueChange={(val) => updateTrack(track.id, { send3: val[0] })} onValueCommit={commit} className="w-full [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5" />
                </div>

                {/* Panning */}
                <div className="flex flex-col gap-1 w-full bg-studio-bg/70 p-1.5 rounded-md border border-foreground/10 mb-1">
                  <div className="text-[8px] text-muted-foreground font-semibold flex justify-between">
                    <span>Pan</span>
                    <span className="font-mono text-[8px]">{track.pan !== undefined ? (track.pan < 50 ? `L${50 - track.pan}` : track.pan > 50 ? `R${track.pan - 50}` : 'C') : 'C'}</span>
                  </div>
                  <Slider
                    value={[track.pan !== undefined ? track.pan : 50]}
                    max={100}
                    aria-label={`Pan for ${track.name}`}
                    onValueChange={(val) => updateTrack(track.id, { pan: val[0] })}
                    onValueCommit={commit}
                    onDoubleClick={() => { updateTrack(track.id, { pan: 50 }); commit(); }}
                    className="w-full [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5"
                  />
                </div>

                {/* Volume Fader & Real VU Meter */}
                <div className="flex-1 flex gap-3 w-full my-2 justify-center">
                  <div className="flex flex-col h-full items-center gap-1.5 w-6">
                    <Slider
                      orientation="vertical"
                      value={[track.volume]}
                      max={100}
                      step={1}
                        aria-label={`Volume for ${track.name}`}
                        onValueChange={(val) => updateVolume(track.id, val)}
                        onValueCommit={commit}
                        className="h-full"
                      />
                    </div>
                  <ChannelPeakMeter track={track} isPlaying={show && isPlaying} mixEngineRef={mixEngineRef} />
                </div>

                <div className="text-[10px] font-mono text-center font-semibold mb-2">{track.volume === 0 ? '-∞' : (20 * Math.log10(track.volume / 100)).toFixed(1)} dB</div>

                <div className="flex gap-1 w-full mb-2">
                  <Button type="button" size="icon" variant="outline" className={cn('w-full h-7 text-[10px] font-bold border-foreground/10', track.muted && 'bg-destructive text-destructive-foreground border-destructive')} onClick={() => toggleMute(track.id)}>M</Button>
                  <Button type="button" size="icon" variant="outline" className={cn('w-full h-7 text-[10px] font-bold border-foreground/10', track.solo && 'bg-yellow-500 text-white border-yellow-500')} onClick={() => toggleSolo(track.id)}>S</Button>

                </div>

                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={isFxOpen}
                  title={fxCount > 0 ? `${fxCount} active insert${fxCount > 1 ? 's' : ''} — open FX chain` : 'Open FX chain'}
                  className={cn(
                    'w-full h-7 text-[10px] gap-1.5 border-foreground/10 hover:bg-studio-raised',
                    isFxOpen && 'border-primary/60 bg-primary/10 text-primary',
                    fxCount > 0 && !isFxOpen && 'border-primary/30 text-primary/90'
                  )}
                  onClick={() => onOpenFX?.(track.id)}
                >
                  <Settings2 className={cn('w-3.5 h-3.5', fxCount > 0 ? 'text-primary' : 'text-muted-foreground')} /> FX
                  {fxCount > 0 && (
                    <span className="ml-auto px-1 rounded bg-primary/20 text-primary font-mono text-[9px] leading-4">{fxCount}</span>
                  )}
                </Button>
              </div>
              );
            })}

            <div className="w-px h-[80%] bg-foreground/10 mx-2 self-center" />

            <div className="w-36 h-full bg-studio-raised border border-primary/20 rounded-lg p-2.5 flex flex-col justify-between shrink-0 shadow-[0_0_15px_hsl(var(--studio-bg)/0.5)] relative">
              <div className="text-[10px] text-center font-black text-primary truncate w-full tracking-wider mb-2">MASTER</div>

              {/* Master Fader & Real VU Meters */}
              <div className="flex-1 flex gap-3 w-full my-2 justify-center">
                <div className="flex flex-col h-full items-center gap-1.5 w-6">
                  <Slider
                    orientation="vertical"
                    value={[masterVolume]}
                    max={100}
                    step={1}
                    onValueChange={(val) => setMasterVolume(val[0])}
                    className="h-full [&_[role=slider]]:border-primary"
                  />
                </div>
                <div className="flex gap-0.5 h-full">
                  <MasterPeakMeter mixEngineRef={mixEngineRef} isPlaying={isPlaying} />
                </div>
              </div>

              <div className="text-[10px] font-mono text-center font-bold text-primary/90 mb-2">{masterVolume === 0 ? '-∞' : (20 * Math.log10(masterVolume / 100)).toFixed(1)} dB</div>


              <Button
                type="button"
                variant="outline"
                aria-pressed={fxTarget === 'master'}
                title={masterFxCount > 0 ? `${masterFxCount} active master insert${masterFxCount > 1 ? 's' : ''}` : 'Open master FX chain'}
                className={cn(
                  'w-full h-7 text-[10px] gap-1.5 border-primary/20 hover:bg-primary/10 text-primary/80',
                  fxTarget === 'master' && 'bg-primary/15 border-primary/60 text-primary'
                )}
                onClick={() => onOpenMasterFX?.()}
              >
                <Activity className="w-3.5 h-3.5" /> MASTER FX
                {masterFxCount > 0 && (
                  <span className="ml-auto px-1 rounded bg-primary/20 text-primary font-mono text-[9px] leading-4">{masterFxCount}</span>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}