import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Square, Settings2 } from 'lucide-react';
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
  toggleSolo 
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 200, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-border/50 bg-card/90 backdrop-blur shrink-0 flex overflow-x-auto custom-scrollbar relative"
        >
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground mr-2">MIXER & FX</span>
            <Button variant="ghost" size="icon" onClick={onClose} className="w-6 h-6 rounded-full"><Square className="w-3 h-3" /></Button>
          </div>
          
          <div className="flex p-4 gap-2 pt-8">
            {tracks.map(track => (
              <div key={track.id} className="w-32 bg-background/50 border border-border/50 rounded-lg p-2 flex flex-col justify-between gap-2 shrink-0">
                <div className="text-[10px] text-center font-medium truncate w-full" title={track.name}>{track.name}</div>
                <div className="flex flex-col gap-2 w-full mt-4">
                  <Slider 
                    value={[track.volume]} 
                    max={100} 
                    step={1} 
                    onValueChange={(val) => updateVolume(track.id, val)}
                    className="w-full"
                  />
                  <div className="text-[10px] font-mono text-center">{track.volume}%</div>
                </div>
                <div className="flex gap-1 w-full mt-1">
                  <Button size="icon" variant="outline" className={cn("w-full h-6 text-[10px]", track.muted && "bg-red-500 text-white")} onClick={() => toggleMute(track.id)}>M</Button>
                  <Button size="icon" variant="outline" className={cn("w-full h-6 text-[10px]", track.solo && "bg-yellow-500 text-white")} onClick={() => toggleSolo(track.id)}>S</Button>
                </div>
                <Button variant="outline" className="w-full h-6 text-[10px] mt-1 gap-1" onClick={() => toast.info(`FX Chain for ${track.name} coming soon`)}>
                  <Settings2 className="w-3 h-3" /> FX
                </Button>
              </div>
            ))}
            
            <div className="w-32 bg-card border border-border rounded-lg p-2 flex flex-col justify-between gap-2 shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
              <div className="text-[10px] text-center font-bold text-primary truncate w-full">MASTER</div>
              <div className="flex flex-col gap-2 w-full mt-4">
                <Slider 
                  value={[masterVolume]} 
                  max={100} 
                  step={1} 
                  onValueChange={(val) => setMasterVolume(val[0])}
                  className="w-full"
                />
                <div className="text-[10px] font-mono text-center">{masterVolume}%</div>
              </div>
              <Button variant="outline" className="w-full h-6 text-[10px] mt-1 gap-1" onClick={() => toast.info(`Master FX Chain coming soon`)}>
                <Settings2 className="w-3 h-3" /> FX
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}