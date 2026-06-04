import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  X, Play, Pause, Scissors, Copy, Trash2, 
  Activity, Radio, Waves, Settings2, SlidersHorizontal,
  VolumeX, Volume2, Save, Wand2, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const EFFECTS = [
  { id: 'eq', name: 'Parametric EQ', icon: SlidersHorizontal },
  { id: 'reverb', name: 'Studio Reverb', icon: Waves },
  { id: 'delay', name: 'Echo Delay', icon: Activity },
  { id: 'compressor', name: 'Compressor', icon: Radio },
  { id: 'distortion', name: 'Distortion', icon: Wand2 },
];

export default function WaveEditor({ track, onClose, onSave }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeEffects, setActiveEffects] = useState([]);
  const [selectedEffect, setSelectedEffect] = useState(null);
  const [zoom, setZoom] = useState(1);

  if (!track) return null;

  const toggleEffect = (effect) => {
    if (activeEffects.some(e => e.id === effect.id)) {
      setActiveEffects(activeEffects.filter(e => e.id !== effect.id));
      if (selectedEffect?.id === effect.id) setSelectedEffect(null);
    } else {
      setActiveEffects([...activeEffects, { ...effect, params: { amount: 50, mix: 50 } }]);
      setSelectedEffect(effect);
    }
  };

  const handleSave = () => {
    toast.success('Track saved with applied effects!');
    onSave(track.id, { ...track, effects: activeEffects });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 md:p-8"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-card border border-border/50 shadow-2xl rounded-2xl w-full max-w-6xl h-full max-h-[800px] flex flex-col overflow-hidden ring-1 ring-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card/50">
            <div className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full", track.color)} />
              <div>
                <h3 className="font-heading font-bold text-lg leading-tight">{track.name}</h3>
                <p className="text-xs text-muted-foreground">Waveform Editor & Effects Chain</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white gap-2">
                <Save className="w-4 h-4" /> Apply Changes
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel: Effects Chain */}
            <div className="w-64 border-r border-border/50 bg-card/30 flex flex-col">
              <div className="p-3 text-sm font-semibold border-b border-border/50 text-muted-foreground flex items-center justify-between">
                <span>Effects Chain</span>
                <Button variant="ghost" size="icon" className="w-6 h-6"><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {EFFECTS.map(effect => {
                  const isActive = activeEffects.some(e => e.id === effect.id);
                  const Icon = effect.icon;
                  return (
                    <button
                      key={effect.id}
                      onClick={() => toggleEffect(effect)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all border",
                        isActive 
                          ? "bg-primary/10 border-primary/30 text-primary shadow-inner" 
                          : "bg-transparent border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {effect.name}
                      </span>
                      <div className={cn("w-2 h-2 rounded-full", isActive ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]" : "bg-muted-foreground/30")} />
                    </button>
                  );
                })}

                <div className="mt-6 pt-4 border-t border-border/50 px-2">
                  <p className="text-xs text-muted-foreground font-medium mb-2">VST Plugins</p>
                  <Button variant="outline" className="w-full text-xs h-8 border-dashed border-border/50 bg-transparent hover:bg-secondary/30">
                    <Plus className="w-3 h-3 mr-2" /> Scan Plugins...
                  </Button>
                </div>
              </div>
            </div>

            {/* Center Panel: Waveform & Editor */}
            <div className="flex-1 flex flex-col bg-[#08080a]">
              {/* Tool bar */}
              <div className="h-12 border-b border-border/30 bg-card/40 flex items-center px-4 gap-2">
                <Button variant="ghost" size="icon" onClick={() => setIsPlaying(!isPlaying)} className={cn(isPlaying && "text-primary")}>
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <div className="w-px h-4 bg-border/50 mx-2" />
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground"><Scissors className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground"><Copy className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <Settings2 className="w-4 h-4" /> Zoom
                  <Slider value={[zoom]} min={0.5} max={3} step={0.1} onValueChange={(v) => setZoom(v[0])} className="w-24" />
                </div>
              </div>

              {/* Huge Waveform View */}
              <div className="flex-1 relative overflow-auto custom-scrollbar p-8 flex items-center justify-center">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px]" />
                <div className="relative w-full max-w-[2000px] h-64 bg-card/20 rounded-xl border border-white/5 flex items-center justify-center gap-[2px] px-4" style={{ transform: `scaleX(${zoom})` }}>
                  {/* Playhead */}
                  {isPlaying && (
                    <motion.div 
                      initial={{ left: 0 }}
                      animate={{ left: "100%" }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                      className="absolute top-0 bottom-0 w-px bg-primary z-10 shadow-[0_0_10px_rgba(var(--primary),0.8)]"
                    />
                  )}
                  {track.waveform && track.waveform.map((val, i) => (
                    <div 
                      key={i} 
                      className={cn("w-2 rounded-full opacity-90 transition-all", track.color)}
                      style={{ height: `${val * 100}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom Panel: Effect Params */}
              <div className="h-48 border-t border-border/50 bg-card/60 p-4">
                {selectedEffect ? (
                  <div className="h-full flex flex-col">
                    <h4 className="font-medium flex items-center gap-2 mb-4">
                      <selectedEffect.icon className="w-4 h-4 text-primary" />
                      {selectedEffect.name} Settings
                    </h4>
                    <div className="flex gap-8">
                      <div className="w-64 space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs"><span>Amount</span><span className="text-muted-foreground">50%</span></div>
                          <Slider defaultValue={[50]} max={100} step={1} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs"><span>Mix (Dry/Wet)</span><span className="text-muted-foreground">75%</span></div>
                          <Slider defaultValue={[75]} max={100} step={1} className="[&_[role=slider]]:bg-primary" />
                        </div>
                      </div>
                      <div className="flex-1 grid grid-cols-4 gap-4">
                        {/* Fake knobs */}
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="flex flex-col items-center justify-center p-4 bg-background/50 rounded-xl border border-border/30">
                            <div className="w-12 h-12 rounded-full border-4 border-secondary relative mb-2">
                              <div className="absolute top-1/2 left-1/2 w-1 h-4 bg-primary origin-bottom -translate-x-1/2 -translate-y-full rotate-[45deg]" />
                            </div>
                            <span className="text-[10px] text-muted-foreground uppercase">Param {i}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
                    <SlidersHorizontal className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">Select an effect from the chain to edit parameters</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}