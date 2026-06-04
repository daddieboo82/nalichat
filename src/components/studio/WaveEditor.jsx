import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  X, Play, Pause, Scissors, Copy, Trash2, 
  Activity, Radio, Waves, Settings2, SlidersHorizontal,
  VolumeX, Volume2, Save, Wand2, Plus, MousePointer2, MoveHorizontal, Crosshair, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const waveformFills = {
  "bg-primary": "fill-primary",
  "bg-pink-500": "fill-pink-500",
  "bg-accent": "fill-accent",
  "bg-yellow-500": "fill-yellow-500",
  "bg-purple-500": "fill-purple-500",
  "bg-green-500": "fill-green-500"
};

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
  const [activeTool, setActiveTool] = useState('smart'); // smart, select, trim, fade
  const [selection, setSelection] = useState({ start: 0.25, end: 0.75 });
  const [fade, setFade] = useState({ in: 0.1, out: 0.1 });
  const [isScanning, setIsScanning] = useState(false);

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
    if (!track) return;
    toast.success('Track saved with applied effects!');
    onSave(track.id, { ...track, effects: activeEffects });
    onClose();
  };

  const handleScanPlugins = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      toast.error("VST3/AU plugin scanning requires the NaliStudio Desktop Client.");
    }, 2000);
  };

  // Power user keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.code === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeEffects, track, onClose, onSave]);

  if (!track) return null;

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
                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => toast.info("Toggle effects from the list below to build your chain.")}>
                  <Plus className="w-4 h-4" />
                </Button>
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
                  <Button 
                    variant="outline" 
                    onClick={handleScanPlugins}
                    disabled={isScanning}
                    className="w-full text-xs h-8 border-dashed border-border/50 bg-transparent hover:bg-secondary/30"
                  >
                    {isScanning ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Plus className="w-3 h-3 mr-2" />}
                    {isScanning ? "Scanning..." : "Scan Plugins..."}
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
                
                <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-lg">
                  <Button variant="ghost" size="icon" onClick={() => setActiveTool('trim')} className={cn("w-7 h-7 rounded text-muted-foreground hover:text-foreground", activeTool === 'trim' && "bg-primary/20 text-primary")} title="Trim"><MoveHorizontal className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setActiveTool('select')} className={cn("w-7 h-7 rounded text-muted-foreground hover:text-foreground", activeTool === 'select' && "bg-primary/20 text-primary")} title="Select"><MousePointer2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setActiveTool('fade')} className={cn("w-7 h-7 rounded text-muted-foreground hover:text-foreground", activeTool === 'fade' && "bg-primary/20 text-primary")} title="Fade"><Crosshair className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setActiveTool('smart')} className={cn("w-7 h-7 rounded text-muted-foreground hover:text-foreground", activeTool === 'smart' && "border-primary text-primary bg-primary/10")} title="Smart Tool">
                     <div className="flex flex-col gap-0.5 items-center">
                       <div className="flex gap-[1px]"><MoveHorizontal className="w-2.5 h-2.5"/><MousePointer2 className="w-2.5 h-2.5"/></div>
                     </div>
                  </Button>
                </div>

                <div className="w-px h-4 bg-border/50 mx-2" />
                <Button variant="ghost" size="icon" onClick={() => {
                  if (selection.start !== selection.end) {
                    const minStart = Math.min(selection.start, selection.end);
                    const maxEnd = Math.max(selection.start, selection.end);
                    const newWaveform = track.waveform.slice(
                      Math.floor(minStart * track.waveform.length),
                      Math.floor(maxEnd * track.waveform.length)
                    );
                    const newTrack = {
                      ...track,
                      waveform: newWaveform,
                      duration: (track.duration || 40) * (maxEnd - minStart),
                      startTime: (track.startTime || 0) + ((track.duration || 40) * minStart)
                    };
                    onSave(track.id, newTrack);
                  } else {
                    toast.error("Use the Select tool to highlight a region first to trim");
                  }
                }} className="text-muted-foreground hover:text-foreground" title="Trim to Selection"><Scissors className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => {
                  if (selection.start !== selection.end) {
                    toast.success("Selection copied to clipboard");
                  } else {
                    toast.error("Make a selection first to copy");
                  }
                }} className="text-muted-foreground hover:text-foreground"><Copy className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => {
                  if (selection.start !== selection.end) {
                    const minStart = Math.min(selection.start, selection.end);
                    const maxEnd = Math.max(selection.start, selection.end);
                    const newWaveform = [
                      ...track.waveform.slice(0, Math.floor(minStart * track.waveform.length)),
                      ...track.waveform.slice(Math.floor(maxEnd * track.waveform.length))
                    ];
                    const newTrack = {
                      ...track,
                      waveform: newWaveform,
                      duration: (track.duration || 40) * (1 - (maxEnd - minStart))
                    };
                    setSelection({ start: 0, end: 0 });
                    onSave(track.id, newTrack);
                    toast.success("Selection deleted");
                  } else {
                    toast.error("Make a selection first to delete");
                  }
                }} className="text-muted-foreground hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <Settings2 className="w-4 h-4" /> Zoom
                  <Slider value={[zoom]} min={0.5} max={3} step={0.1} onValueChange={(v) => setZoom(v[0])} className="w-24" />
                </div>
              </div>

              {/* Huge Waveform View */}
              <div 
                className="flex-1 relative overflow-x-auto overflow-y-hidden custom-scrollbar p-8 flex items-center justify-start"
                onWheel={(e) => {
                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.ctrlKey && !e.metaKey) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
                <div 
                  className={cn("relative h-64 bg-card/20 rounded-xl border border-white/5 flex items-center justify-between gap-px overflow-hidden", 
                    activeTool === 'select' ? "cursor-text" : 
                    activeTool === 'trim' ? "cursor-ew-resize" : 
                    activeTool === 'fade' ? "cursor-crosshair" : "cursor-default"
                  )} 
                  style={{ width: `${100 * zoom}%`, minWidth: '100%' }}
                  onPointerDown={(e) => {
                    if (activeTool !== 'select' && activeTool !== 'smart') return;
                    const target = e.currentTarget;
                    const rect = target.getBoundingClientRect();
                    const startX = (e.clientX - rect.left) / rect.width;
                    setSelection({ start: startX, end: startX });
                    
                    target.setPointerCapture(e.pointerId);
                    
                    const handleMove = (moveEvent) => {
                      const currentX = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
                      setSelection({ start: Math.min(startX, currentX), end: Math.max(startX, currentX) });
                    };
                    
                    const handleUp = (upEvent) => {
                      target.releasePointerCapture(upEvent.pointerId);
                      target.removeEventListener('pointermove', handleMove);
                      target.removeEventListener('pointerup', handleUp);
                    };
                    
                    target.addEventListener('pointermove', handleMove);
                    target.addEventListener('pointerup', handleUp);
                  }}
                >
                  {/* Selection Overlay */}
                  {selection.start !== selection.end && (
                    <div 
                      className="absolute top-0 bottom-0 bg-primary/20 border-x-2 border-primary z-10 pointer-events-none"
                      style={{ left: `${selection.start * 100}%`, right: `${(1 - selection.end) * 100}%` }}
                    >
                      {/* Left Figure */}
                      <div 
                        className="absolute top-0 bottom-0 -left-3 w-6 cursor-ew-resize flex items-center justify-center hover:bg-white/10 pointer-events-auto"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const target = e.currentTarget;
                          const container = target.parentElement.parentElement;
                          const rect = container.getBoundingClientRect();
                          target.setPointerCapture(e.pointerId);
                          
                          const handleMove = (moveEvent) => {
                            const currentX = Math.max(0, Math.min(selection.end - 0.01, (moveEvent.clientX - rect.left) / rect.width));
                            if (target.parentElement) {
                              target.parentElement.style.left = `${currentX * 100}%`;
                            }
                            target.dataset.newStart = currentX;
                          };
                          
                          const handleUp = (upEvent) => {
                            target.releasePointerCapture(upEvent.pointerId);
                            target.removeEventListener('pointermove', handleMove);
                            target.removeEventListener('pointerup', handleUp);
                            const newStartStr = target.dataset.newStart;
                            if (newStartStr !== undefined) {
                              setSelection(prev => ({ ...prev, start: parseFloat(newStartStr) }));
                              delete target.dataset.newStart;
                            }
                          };
                          
                          target.addEventListener('pointermove', handleMove);
                          target.addEventListener('pointerup', handleUp);
                        }}
                      >
                        <div className="w-1.5 h-8 bg-primary rounded-full shadow-sm" />
                      </div>
                      
                      {/* Right Figure */}
                      <div 
                        className="absolute top-0 bottom-0 -right-3 w-6 cursor-ew-resize flex items-center justify-center hover:bg-white/10 pointer-events-auto"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const target = e.currentTarget;
                          const container = target.parentElement.parentElement;
                          const rect = container.getBoundingClientRect();
                          target.setPointerCapture(e.pointerId);
                          
                          const handleMove = (moveEvent) => {
                            const currentX = Math.max(selection.start + 0.01, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
                            if (target.parentElement) {
                              target.parentElement.style.right = `${(1 - currentX) * 100}%`;
                            }
                            target.dataset.newEnd = currentX;
                          };
                          
                          const handleUp = (upEvent) => {
                            target.releasePointerCapture(upEvent.pointerId);
                            target.removeEventListener('pointermove', handleMove);
                            target.removeEventListener('pointerup', handleUp);
                            const newEndStr = target.dataset.newEnd;
                            if (newEndStr !== undefined) {
                              setSelection(prev => ({ ...prev, end: parseFloat(newEndStr) }));
                              delete target.dataset.newEnd;
                            }
                          };
                          
                          target.addEventListener('pointermove', handleMove);
                          target.addEventListener('pointerup', handleUp);
                        }}
                      >
                        <div className="w-1.5 h-8 bg-primary rounded-full shadow-sm" />
                      </div>
                    </div>
                  )}

                  {/* Fade In/Out Overlays & Handles */}
                  <div 
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none"
                    style={{ width: `${fade.in * 100}%` }}
                  />
                  {(activeTool === 'fade' || activeTool === 'smart') && (
                    <div className="absolute top-0 bottom-0 w-6 cursor-ew-resize hover:bg-white/10 flex items-center justify-center group z-20 pointer-events-auto"
                      style={{ left: `calc(${fade.in * 100}% - 12px)` }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const target = e.currentTarget;
                        const container = target.parentElement;
                        const rect = container.getBoundingClientRect();
                        target.setPointerCapture(e.pointerId);
                        
                        const handleMove = (moveEvent) => {
                          const currentX = Math.max(0, Math.min(1 - fade.out, (moveEvent.clientX - rect.left) / rect.width));
                          target.style.left = `calc(${currentX * 100}% - 12px)`;
                          if (target.previousElementSibling) {
                            target.previousElementSibling.style.width = `${currentX * 100}%`;
                          }
                          target.dataset.newFade = currentX;
                        };
                        
                        const handleUp = (upEvent) => {
                          target.releasePointerCapture(upEvent.pointerId);
                          target.removeEventListener('pointermove', handleMove);
                          target.removeEventListener('pointerup', handleUp);
                          const newFadeStr = target.dataset.newFade;
                          if (newFadeStr !== undefined) {
                            setFade(prev => ({ ...prev, in: parseFloat(newFadeStr) }));
                            delete target.dataset.newFade;
                          }
                        };
                        
                        target.addEventListener('pointermove', handleMove);
                        target.addEventListener('pointerup', handleUp);
                      }}
                    >
                      <div className="w-1 h-6 bg-white/50 group-hover:bg-white rounded-full transition-colors shadow-sm" />
                    </div>
                  )}

                  <div 
                    className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none"
                    style={{ width: `${fade.out * 100}%` }}
                  />
                  {(activeTool === 'fade' || activeTool === 'smart') && (
                    <div className="absolute top-0 bottom-0 w-6 cursor-ew-resize hover:bg-white/10 flex items-center justify-center group z-20 pointer-events-auto"
                      style={{ right: `calc(${fade.out * 100}% - 12px)` }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const target = e.currentTarget;
                        const container = target.parentElement;
                        const rect = container.getBoundingClientRect();
                        target.setPointerCapture(e.pointerId);
                        
                        const handleMove = (moveEvent) => {
                          const currentX = Math.max(0, Math.min(1 - fade.in, 1 - ((moveEvent.clientX - rect.left) / rect.width)));
                          target.style.right = `calc(${currentX * 100}% - 12px)`;
                          if (target.previousElementSibling) {
                            target.previousElementSibling.style.width = `${currentX * 100}%`;
                          }
                          target.dataset.newFade = currentX;
                        };
                        
                        const handleUp = (upEvent) => {
                          target.releasePointerCapture(upEvent.pointerId);
                          target.removeEventListener('pointermove', handleMove);
                          target.removeEventListener('pointerup', handleUp);
                          const newFadeStr = target.dataset.newFade;
                          if (newFadeStr !== undefined) {
                            setFade(prev => ({ ...prev, out: parseFloat(newFadeStr) }));
                            delete target.dataset.newFade;
                          }
                        };
                        
                        target.addEventListener('pointermove', handleMove);
                        target.addEventListener('pointerup', handleUp);
                      }}
                    >
                      <div className="w-1 h-6 bg-white/50 group-hover:bg-white rounded-full transition-colors shadow-sm" />
                    </div>
                  )}

                  {/* Playhead */}
                  {isPlaying && (
                    <motion.div 
                      initial={{ left: 0 }}
                      animate={{ left: "100%" }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                      className="absolute top-0 bottom-0 w-px bg-primary z-20 shadow-[0_0_10px_rgba(var(--primary),0.8)]"
                    />
                  )}
                  
                  {track.waveform && track.waveform.length > 0 && (
                    <div className="absolute inset-x-0 overflow-hidden pointer-events-none bottom-1 top-5">
                      <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
                        <path 
                          d={(() => {
                            const wLen = track.waveform.length - 1 || 1;
                            let d = `M 0,50 `;
                            for(let i=0; i<=wLen; i++) d += `L ${(i/wLen)*1000},${50 - Math.max(0.02, track.waveform[i])*50} `;
                            for(let i=wLen; i>=0; i--) d += `L ${(i/wLen)*1000},${50 + Math.max(0.02, track.waveform[i])*50} `;
                            return d + 'Z';
                          })()}
                          className={cn("opacity-90 drop-shadow-md", waveformFills[track.color] || "fill-primary")}
                        />
                      </svg>
                    </div>
                  )}
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