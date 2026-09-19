import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Square, Settings2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countActiveEffects, getTrackEffects } from '@/lib/audioProcessing';

/**
 * Pro Tools-style mixer panel with REAL metering.
 * Reads actual amplitude from each track's waveform data at the current
 * playback position — gives content-accurate VU levels, not random noise.
 */
function WaveformVuMeter({ track, isPlaying, currentTimeRef, isMaster = false, masterVolume, silenced = false }) {
  const [level, setLevel] = useState(0);
  const peakRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      if (isPlaying && !silenced && !track?.muted && track?.waveform?.length > 0) {
        const t = currentTimeRef?.current || 0;
        const trackStart = track.startTime || 0;
        const trackEnd = trackStart + (track.duration || 40);
        if (t >= trackStart && t < trackEnd) {
          const posInTrack = t - trackStart;
          const fullDuration = track.fullDuration || track.duration || 40;
          const waveformIdx = Math.floor((posInTrack / fullDuration) * track.waveform.length) % track.waveform.length;
          const rawLevel = track.waveform[waveformIdx] || 0;
          const volScale = isMaster ? (masterVolume / 100) : (track.volume / 100) * (masterVolume / 100);
          const scaled = Math.min(1, rawLevel * volScale * 1.5);
          setLevel(scaled);
          if (scaled > peakRef.current) peakRef.current = scaled;
          else peakRef.current = Math.max(0, peakRef.current - 0.008);
        } else {
          setLevel(0);
          peakRef.current = Math.max(0, peakRef.current - 0.01);
        }
      } else {
        setLevel(0);
        peakRef.current = Math.max(0, peakRef.current - 0.01);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, track, masterVolume, isMaster, currentTimeRef, silenced]);

  const pct = Math.round(level * 100);
  const peakPct = Math.round(peakRef.current * 100);

  return (
    <div className="w-2 h-full bg-black/60 rounded-full overflow-hidden flex flex-col justify-end border border-white/5 shadow-inner relative">
      <div
        className={cn('w-full transition-all duration-75', pct > 85 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : pct > 60 ? 'bg-yellow-400' : 'bg-green-500')}
        style={{ height: `${pct}%` }}
      />
      {peakPct > 5 && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-white/60 pointer-events-none"
          style={{ bottom: `${peakPct}%` }}
        />
      )}
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
}) {
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
          className="border-t border-border/50 bg-card/90 backdrop-blur shrink-0 flex overflow-x-auto custom-scrollbar relative w-full"
        >
          <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
            <span className="text-xs font-bold text-muted-foreground mr-2">MIXER & FX</span>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} className="w-6 h-6 rounded-full"><Square className="w-3 h-3" /></Button>
          </div>

          <div className="flex sm:flex-nowrap p-4 gap-3 pt-8 pb-4 h-full items-end w-max min-w-full">
            {tracks.map(track => {
              const fxCount = countActiveEffects(getTrackEffects(track));
              const sendLevel = Math.max(0, Math.min(100, track.send1 || 0));
              const send2Level = Math.max(0, Math.min(100, track.send2 || 0));
              const send3Level = Math.max(0, Math.min(100, track.send3 || 0));
              const isFxOpen = fxTarget === track.id;
              return (
              <div key={track.id} className="w-36 h-full bg-background/50 border border-border/50 rounded-lg p-2.5 flex flex-col justify-between shrink-0 shadow-sm relative">
                <div className="text-[10px] text-center font-bold text-foreground/90 truncate w-full mb-1" title={track.name}>{track.name}</div>

                {/* Sends Routing */}
                <div className="flex flex-col gap-1 w-full bg-black/20 p-1.5 rounded-md border border-white/5 mb-1">
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
                <div className="flex flex-col gap-1 w-full bg-black/20 p-1.5 rounded-md border border-white/5 mb-1">
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
                  <WaveformVuMeter track={track} isPlaying={isPlaying} currentTimeRef={currentTimeRef} masterVolume={masterVolume} silenced={soloActive && !track.solo} />
                </div>

                <div className="text-[10px] font-mono text-center font-semibold mb-2">{track.volume === 0 ? '-∞' : (20 * Math.log10(track.volume / 100)).toFixed(1)} dB</div>

                <div className="flex gap-1 w-full mb-2">
                  <Button type="button" size="icon" variant="outline" className={cn('w-full h-7 text-[10px] font-bold border-border/50', track.muted && 'bg-red-500 text-white border-red-500')} onClick={() => toggleMute(track.id)}>M</Button>
                  <Button type="button" size="icon" variant="outline" className={cn('w-full h-7 text-[10px] font-bold border-border/50', track.solo && 'bg-yellow-500 text-white border-yellow-500')} onClick={() => toggleSolo(track.id)}>S</Button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={isFxOpen}
                  title={fxCount > 0 ? `${fxCount} active insert${fxCount > 1 ? 's' : ''} — open FX chain` : 'Open FX chain'}
                  className={cn(
                    'w-full h-7 text-[10px] gap-1.5 border-border/50 hover:bg-secondary',
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

            <div className="w-px h-[80%] bg-border/50 mx-2 self-center" />

            <div className="w-36 h-full bg-card border border-primary/20 rounded-lg p-2.5 flex flex-col justify-between shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.4)] relative">
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
                  <WaveformVuMeter track={tracks[0]} isPlaying={isPlaying} currentTimeRef={currentTimeRef} isMaster masterVolume={masterVolume} />
                  <WaveformVuMeter track={tracks[1] || tracks[0]} isPlaying={isPlaying} currentTimeRef={currentTimeRef} isMaster masterVolume={masterVolume} />
                </div>
              </div>

              <div className="text-[10px] font-mono text-center font-bold text-primary/90 mb-2">{masterVolume === 0 ? '-∞' : (20 * Math.log10(masterVolume / 100)).toFixed(1)} dB</div>

              <div className="flex gap-1 w-full mb-2 opacity-0 pointer-events-none">
                <Button type="button" size="icon" className="w-full h-7">M</Button>
              </div>

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