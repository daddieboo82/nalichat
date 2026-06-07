import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Square, Settings2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  updateTrack
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 320, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-border/50 bg-card/90 backdrop-blur shrink-0 flex overflow-x-auto custom-scrollbar relative"
        >
          <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
            <span className="text-xs font-bold text-muted-foreground mr-2">MIXER & FX</span>
            <Button variant="ghost" size="icon" onClick={onClose} className="w-6 h-6 rounded-full"><Square className="w-3 h-3" /></Button>
          </div>
          
          <div className="flex p-4 gap-3 pt-8 pb-4 h-full items-end">
            {tracks.map(track => {
              const vuLevel = !track.muted && track.waveform && track.waveform.length > 0 ? (track.volume / 100) * 80 + Math.random()*20 : 0;
              return (
              <div key={track.id} className="w-36 h-full bg-background/50 border border-border/50 rounded-lg p-2.5 flex flex-col justify-between shrink-0 shadow-sm relative">
                <div className="text-[10px] text-center font-bold text-foreground/90 truncate w-full mb-1" title={track.name}>{track.name}</div>
                
                {/* Sends Routing */}
                <div className="flex flex-col gap-1 w-full bg-black/20 p-1.5 rounded-md border border-white/5 mb-1">
                  <div className="text-[8px] text-muted-foreground font-semibold flex justify-between">
                    <span>Send 1 (Rev)</span>
                    <span className="font-mono text-[8px] text-primary/80">{track.send1 || 0}%</span>
                  </div>
                  <Slider value={[track.send1 || 0]} max={100} onValueChange={(val) => updateTrack(track.id, {send1: val[0]})} className="w-full [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5 [&_[role=slider]]:bg-primary/80" />
                </div>

                {/* Panning */}
                <div className="flex flex-col gap-1 w-full bg-black/20 p-1.5 rounded-md border border-white/5 mb-1">
                  <div className="text-[8px] text-muted-foreground font-semibold flex justify-between">
                    <span>Pan</span>
                    <span className="font-mono text-[8px]">{track.pan !== undefined ? (track.pan < 50 ? `L${50-track.pan}` : track.pan > 50 ? `R${track.pan-50}` : 'C') : 'C'}</span>
                  </div>
                  <Slider value={[track.pan !== undefined ? track.pan : 50]} max={100} onValueChange={(val) => updateTrack(track.id, {pan: val[0]})} className="w-full [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5" />
                </div>

                {/* Volume Fader & VU Meter */}
                <div className="flex-1 flex gap-3 w-full my-2 justify-center">
                  <div className="flex flex-col h-full items-center gap-1.5 w-6">
                    <Slider 
                      orientation="vertical"
                      value={[track.volume]} 
                      max={100} 
                      step={1} 
                      onValueChange={(val) => updateVolume(track.id, val)}
                      className="h-full"
                    />
                  </div>
                  <div className="w-2 h-full bg-black/60 rounded-full overflow-hidden flex flex-col justify-end border border-white/5 shadow-inner">
                    <div className={cn("w-full transition-all duration-75", vuLevel > 85 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : vuLevel > 60 ? "bg-yellow-400" : "bg-green-500")} style={{ height: `${track.muted ? 0 : vuLevel}%` }} />
                  </div>
                </div>
                
                <div className="text-[10px] font-mono text-center font-semibold mb-2">{track.volume.toFixed(1)} dB</div>
                
                <div className="flex gap-1 w-full mb-2">
                  <Button size="icon" variant="outline" className={cn("w-full h-7 text-[10px] font-bold border-border/50", track.muted && "bg-red-500 text-white border-red-500")} onClick={() => toggleMute(track.id)}>M</Button>
                  <Button size="icon" variant="outline" className={cn("w-full h-7 text-[10px] font-bold border-border/50", track.solo && "bg-yellow-500 text-white border-yellow-500")} onClick={() => toggleSolo(track.id)}>S</Button>
                </div>
                
                <Button variant="outline" className="w-full h-7 text-[10px] gap-1.5 border-border/50 hover:bg-secondary" onClick={() => onOpenFX ? onOpenFX(track.id) : toast.info(`FX Chain coming soon`)}>
                  <Settings2 className="w-3.5 h-3.5 text-muted-foreground" /> FX
                </Button>
              </div>
            )})}
            
            <div className="w-px h-[80%] bg-border/50 mx-2 self-center" />
            
            <div className="w-36 h-full bg-card border border-primary/20 rounded-lg p-2.5 flex flex-col justify-between shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.4)] relative">
              <div className="text-[10px] text-center font-black text-primary truncate w-full tracking-wider mb-2">MASTER</div>
              
              {/* Output VU Meters */}
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
                  <div className="w-2 h-full bg-black/60 rounded-full overflow-hidden flex flex-col justify-end border border-white/5 shadow-inner">
                    <div className={cn("w-full transition-all duration-75", masterVolume > 85 ? "bg-red-500" : masterVolume > 60 ? "bg-yellow-400" : "bg-green-500")} style={{ height: `${masterVolume * 0.9}%` }} />
                  </div>
                  <div className="w-2 h-full bg-black/60 rounded-full overflow-hidden flex flex-col justify-end border border-white/5 shadow-inner">
                    <div className={cn("w-full transition-all duration-75 delay-75", masterVolume > 85 ? "bg-red-500" : masterVolume > 60 ? "bg-yellow-400" : "bg-green-500")} style={{ height: `${masterVolume * 0.85}%` }} />
                  </div>
                </div>
              </div>
              
              <div className="text-[10px] font-mono text-center font-bold text-primary/90 mb-2">{masterVolume.toFixed(1)} dB</div>
              
              <div className="flex gap-1 w-full mb-2 opacity-0 pointer-events-none">
                <Button size="icon" className="w-full h-7">M</Button>
              </div>
              
              <Button variant="outline" className="w-full h-7 text-[10px] gap-1.5 border-primary/20 hover:bg-primary/10 text-primary/80" onClick={() => toast.info(`Master FX Chain coming soon`)}>
                <Activity className="w-3.5 h-3.5" /> MASTER FX
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}