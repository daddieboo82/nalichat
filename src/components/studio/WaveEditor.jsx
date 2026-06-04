import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  X, Play, Pause, Scissors, Copy, Trash2, 
  Activity, Radio, Waves, Settings2, SlidersHorizontal,
  VolumeX, Volume2, Save, Wand2, Plus, MousePointer2, MoveHorizontal, Crosshair, Loader2, Undo2, Redo2, Maximize2, SplitSquareHorizontal, Magnet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Knob } from '@/components/ui/knob';

const waveformFills = {
  "bg-primary": "fill-primary",
  "bg-pink-500": "fill-pink-500",
  "bg-accent": "fill-accent",
  "bg-yellow-500": "fill-yellow-500",
  "bg-purple-500": "fill-purple-500",
  "bg-green-500": "fill-green-500"
};

const EFFECTS = [
  { id: 'eq', name: 'EQ Eight', icon: SlidersHorizontal, params: [{name: 'Low', min: -15, max: 15}, {name: 'Mid', min: -15, max: 15}, {name: 'High', min: -15, max: 15}, {name: 'Freq', min: 20, max: 20000}] },
  { id: 'reverb', name: 'Valhalla Reverb', icon: Waves, params: [{name: 'Decay', min: 0, max: 10}, {name: 'Size', min: 0, max: 100}, {name: 'Mix', min: 0, max: 100}] },
  { id: 'delay', name: 'Echo', icon: Activity, params: [{name: 'Time', min: 1, max: 2000}, {name: 'Feedback', min: 0, max: 100}, {name: 'Mix', min: 0, max: 100}] },
  { id: 'compressor', name: 'Glue Compressor', icon: Radio, params: [{name: 'Thresh', min: -60, max: 0}, {name: 'Ratio', min: 1, max: 20}, {name: 'Attack', min: 0, max: 100}, {name: 'Release', min: 0, max: 100}] },
  { id: 'distortion', name: 'Saturator', icon: Wand2, params: [{name: 'Drive', min: 0, max: 100}, {name: 'Tone', min: 0, max: 100}, {name: 'Mix', min: 0, max: 100}] },
];

export default function WaveEditor({ track, onClose, onSave }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeEffects, setActiveEffects] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState('select'); // select, split, move
  const [segments, setSegments] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [playhead, setPlayhead] = useState(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [snapToGrid, setSnapToGrid] = useState(true);

  const containerRef = useRef(null);

  const getSnappedTime = (time) => {
    if (!snapToGrid) return time;
    const snapInterval = zoom > 5 ? 0.1 : zoom > 2 ? 0.5 : 1;
    return Math.round(time / snapInterval) * snapInterval;
  };

  // Initialize segments
  useEffect(() => {
    if (track && segments.length === 0) {
      const initialSegs = track.segments && track.segments.length > 0 ? track.segments : [{
        id: `seg_${Date.now()}`,
        startOffset: 0, // time in track where this segment starts
        sourceStart: 0, // normalized 0-1
        sourceEnd: 1, // normalized 0-1
        duration: track.duration || 40,
        waveform: track.waveform || Array.from({length: 100}, () => Math.random())
      }];
      setSegments(initialSegs);
      setHistory([initialSegs]);
      setHistoryIdx(0);
      if (track.effects) setActiveEffects(track.effects);
    }
  }, [track]);

  const saveHistory = (newSegs) => {
    const newHist = history.slice(0, historyIdx + 1);
    newHist.push(newSegs);
    setHistory(newHist);
    setHistoryIdx(newHist.length - 1);
    setSegments(newSegs);
  };

  const handleUndo = () => {
    if (historyIdx > 0) {
      setHistoryIdx(historyIdx - 1);
      setSegments(history[historyIdx - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      setHistoryIdx(historyIdx + 1);
      setSegments(history[historyIdx + 1]);
    }
  };

  const handleContainerClick = (e) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
      const totalWidth = rect.width * zoom;
      let clickTime = (clickX / totalWidth) * (track?.duration || 40);
      clickTime = getSnappedTime(clickTime);

      const segmentEl = e.target.closest('.audio-segment');
      const clickedSegId = segmentEl ? segmentEl.dataset.segmentId : null;

      if (activeTool === 'split') {
        const segIndex = segments.findIndex(s => clickTime > s.startOffset && clickTime < (s.startOffset + s.duration));
        if (segIndex !== -1) {
          const seg = segments[segIndex];
          const splitRatio = (clickTime - seg.startOffset) / seg.duration;
          const splitSourceTime = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * splitRatio;
          
          const newSeg1 = { ...seg, id: `seg_${Date.now()}_1`, sourceEnd: splitSourceTime, duration: seg.duration * splitRatio, waveform: seg.waveform.slice(0, Math.floor(seg.waveform.length * splitRatio)) };
          const newSeg2 = { ...seg, id: `seg_${Date.now()}_2`, startOffset: clickTime, sourceStart: splitSourceTime, duration: seg.duration * (1 - splitRatio), waveform: seg.waveform.slice(Math.floor(seg.waveform.length * splitRatio)) };

          const newSegs = [...segments];
          newSegs.splice(segIndex, 1, newSeg1, newSeg2);
          saveHistory(newSegs);
          toast.success("Segment split");
        }
      } else {
        setPlayhead(clickTime);
        if (clickedSegId) {
          setSelectedSegmentId(clickedSegId);
        } else {
          setSelectedSegmentId(null);
        }
      }
    }
  };

  const handleSegmentDragEnd = (id, newOffset) => {
    const snappedOffset = getSnappedTime(newOffset);
    const newSegs = segments.map(s => s.id === id ? { ...s, startOffset: snappedOffset } : s);
    saveHistory(newSegs);
  };

  const addEffect = (effect) => {
    if (activeEffects.some(e => e.id === effect.id)) {
        toast.info(`${effect.name} is already in the rack`);
        return;
    }
    const initialParams = {};
    effect.params.forEach(p => initialParams[p.name] = (p.min + p.max) / 2);
    setActiveEffects([...activeEffects, { ...effect, paramValues: initialParams }]);
  };

  const updateEffectParam = (effectId, paramName, val) => {
    setActiveEffects(prev => prev.map(e => {
      if (e.id === effectId) {
        return { ...e, paramValues: { ...e.paramValues, [paramName]: val } };
      }
      return e;
    }));
  };

  const removeEffect = (id) => {
    setActiveEffects(activeEffects.filter(e => e.id !== id));
  };

  const handleSave = () => {
    onSave(track.id, { ...track, segments, effects: activeEffects });
    onClose();
    toast.success("Track edits saved!");
  };

  // Playhead animation
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlayhead(p => {
          const next = p + 0.1;
          if (next > (track?.duration || 40)) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, track]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.code === 'Backspace' || e.code === 'Delete') {
        setSegments(prev => {
          if (!selectedSegmentId) return prev;
          const newSegs = prev.filter(s => s.id !== selectedSegmentId);
          saveHistory(newSegs);
          setSelectedSegmentId(null);
          return newSegs;
        });
      } else if (e.code === 'Digit1') {
        setActiveTool('select');
      } else if (e.code === 'Digit2') {
        setActiveTool('move');
      } else if (e.code === 'Digit3') {
        setActiveTool('split');
      } else if (e.code === 'KeyS') {
        setSegments(prev => {
          const segIndex = prev.findIndex(s => playhead > s.startOffset && playhead < (s.startOffset + s.duration));
          if (segIndex !== -1) {
            const seg = prev[segIndex];
            const splitRatio = (playhead - seg.startOffset) / seg.duration;
            const splitSourceTime = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * splitRatio;
            
            const newSeg1 = { ...seg, id: `seg_${Date.now()}_1`, sourceEnd: splitSourceTime, duration: seg.duration * splitRatio, waveform: seg.waveform.slice(0, Math.floor(seg.waveform.length * splitRatio)) };
            const newSeg2 = { ...seg, id: `seg_${Date.now()}_2`, startOffset: playhead, sourceStart: splitSourceTime, duration: seg.duration * (1 - splitRatio), waveform: seg.waveform.slice(Math.floor(seg.waveform.length * splitRatio)) };
            
            const newSegs = [...prev];
            newSegs.splice(segIndex, 1, newSeg1, newSeg2);
            saveHistory(newSegs);
            toast.success("Split at playhead");
            return newSegs;
          }
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIdx, history, selectedSegmentId, playhead]);

  if (!track) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl p-4"
      >
        <motion.div 
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          className="bg-[#1c1c1e] text-white shadow-2xl rounded-lg w-full max-w-[1400px] h-[90vh] flex flex-col overflow-hidden ring-1 ring-white/10"
        >
          {/* Header - Ableton Style */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#252528]">
            <div className="flex items-center gap-4">
              <div className={cn("w-3 h-3 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]", track.color)} />
              <h3 className="font-medium text-sm tracking-wide">{track.name}</h3>
            </div>
            
            {/* Transport Controls */}
            <div className="flex items-center gap-1 bg-[#151516] p-1 rounded-md">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:text-white" onClick={() => setPlayhead(0)}>
                <div className="w-1 h-3 bg-current" />
              </Button>
              <Button variant="ghost" size="icon" className={cn("h-7 w-7", isPlaying ? "text-green-400 bg-green-400/10" : "text-white/70 hover:text-white")} onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-white/70 hover:text-white">Cancel</Button>
              <Button size="sm" onClick={handleSave} className="h-8 bg-primary hover:bg-primary/90 text-white gap-2 rounded-md">
                <Save className="w-3.5 h-3.5" /> Save
              </Button>
            </div>
          </div>

          {/* Main DAW View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Toolbar */}
            <div className="h-10 bg-[#2d2d30] border-b border-white/5 flex items-center px-4 gap-4 text-sm shrink-0">
              <div className="flex items-center gap-1 bg-[#1a1a1c] p-1 rounded-md border border-white/5">
                <Button variant="ghost" size="icon" onClick={() => setActiveTool('select')} className={cn("h-6 w-6 rounded", activeTool === 'select' && "bg-primary/20 text-primary")} title="Select / Move Playhead (Shortcut: 1)">
                  <MousePointer2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setActiveTool('move')} className={cn("h-6 w-6 rounded", activeTool === 'move' && "bg-primary/20 text-primary")} title="Move Segments (Shortcut: 2)">
                  <MoveHorizontal className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setActiveTool('split')} className={cn("h-6 w-6 rounded", activeTool === 'split' && "bg-primary/20 text-primary")} title="Split Segment (Shortcut: 3)">
                  <Scissors className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="w-px h-4 bg-white/10" />

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handleUndo} disabled={historyIdx <= 0} className="h-6 w-6 text-white/70 disabled:opacity-30" title="Undo (Cmd+Z)">
                  <Undo2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleRedo} disabled={historyIdx >= history.length - 1} className="h-6 w-6 text-white/70 disabled:opacity-30" title="Redo (Cmd+Shift+Z)">
                  <Redo2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="w-px h-4 bg-white/10" />

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSnapToGrid(!snapToGrid)} 
                className={cn("h-6 px-2 text-[10px] uppercase font-bold tracking-wider", snapToGrid ? "bg-primary/20 text-primary border border-primary/30" : "text-white/50 border border-transparent")}
                title="Snap to Grid"
              >
                <Magnet className="w-3 h-3 mr-1" />
                Snap
              </Button>

              <div className="ml-auto flex items-center gap-3">
                <span className="text-white/50 text-[10px] uppercase tracking-wider font-bold">Zoom</span>
                <Slider value={[zoom]} min={0.5} max={15} step={0.1} onValueChange={(v) => setZoom(v[0])} className="w-32 [&_[role=slider]]:bg-white [&_[role=slider]]:border-none" />
              </div>
            </div>

            {/* Arrangement View */}
            <div 
              className="flex-1 relative bg-[#151516] overflow-x-auto overflow-y-hidden custom-scrollbar focus:outline-none" 
              ref={containerRef} 
              onClick={handleContainerClick}
              tabIndex={0}
              onWheel={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                  setZoom(z => Math.max(0.5, Math.min(15, z * zoomFactor)));
                }
              }}
            >
              {/* Spectral Background Simulation */}
              <div className="absolute inset-0 opacity-30 pointer-events-none mix-blend-screen" style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #2563eb 2px, #8b5cf6 4px), repeating-linear-gradient(90deg, #151516, #151516 4px, transparent 4px, transparent 8px)',
                backgroundSize: '100% 100%, 10px 10px'
              }}>
                {/* Simulated spectral hotspots */}
                {Array.from({length: 30}).map((_, i) => (
                  <div key={i} className="absolute rounded-full blur-[20px] bg-primary/50 mix-blend-screen animate-pulse" style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    width: `${50 + Math.random() * 150}px`,
                    height: `${20 + Math.random() * 60}px`,
                    animationDuration: `${1 + Math.random() * 4}s`
                  }} />
                ))}
              </div>
              
              {/* Timeline Grid */}
              <div className="absolute inset-0 pointer-events-none border-t border-white/5" style={{ width: `${100 * zoom}%`, minWidth: '100%' }}>
                {Array.from({ length: Math.ceil(track?.duration || 40) }).map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-l border-white/5" style={{ left: `${(i/(track?.duration || 40))*100}%` }}>
                    <span className="absolute top-1 left-1 text-[9px] text-white/30 font-mono">{i}s</span>
                  </div>
                ))}
              </div>

              {/* Segments Container */}
              <div className="absolute top-8 bottom-4 left-0" style={{ width: `${100 * zoom}%`, minWidth: '100%' }}>
                {segments.map((seg, idx) => (
                  <motion.div
                    key={seg.id}
                    data-segment-id={seg.id}
                    drag={activeTool === 'move' ? 'x' : false}
                    dragMomentum={false}
                    onDragEnd={(e, info) => {
                      if (activeTool !== 'move') return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const totalWidth = rect.width * zoom;
                      const timeShift = (info.offset.x / totalWidth) * (track?.duration || 40);
                      handleSegmentDragEnd(seg.id, Math.max(0, seg.startOffset + timeShift));
                    }}
                    className={cn(
                      "audio-segment absolute top-0 bottom-0 rounded-md border bg-[#1c1c1e]/80 backdrop-blur-sm overflow-hidden flex items-center shadow-lg transition-all group",
                      activeTool === 'move' ? "cursor-grab active:cursor-grabbing hover:border-primary/50" : "",
                      activeTool === 'split' ? "hover:border-red-500/50 cursor-crosshair" : "",
                      selectedSegmentId === seg.id ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.5)] z-10" : "border-white/20 z-0"
                    )}
                    style={{
                      left: `${(seg.startOffset / (track?.duration || 40)) * 100}%`,
                      width: `${(seg.duration / (track?.duration || 40)) * 100}%`
                    }}
                  >
                    {/* Header bar of segment */}
                    <div className="absolute top-0 left-0 right-0 h-5 bg-black/40 flex items-center px-2 group-hover:bg-primary/20 transition-colors">
                      <span className="text-[10px] text-white/80 font-mono truncate">{track.name} [{idx+1}]</span>
                    </div>

                    {/* Waveform */}
                    <svg className="w-full h-full pt-5 pb-1" preserveAspectRatio="none" viewBox="0 0 1000 100">
                      <path 
                        d={(() => {
                          const wf = seg.waveform || [];
                          const wLen = wf.length - 1 || 1;
                          let d = `M 0,50 `;
                          for(let i=0; i<=wLen; i++) d += `L ${(i/wLen)*1000},${50 - Math.max(0.02, wf[i])*45} `;
                          for(let i=wLen; i>=0; i--) d += `L ${(i/wLen)*1000},${50 + Math.max(0.02, wf[i])*45} `;
                          return d + 'Z';
                        })()}
                        className={cn("opacity-90", waveformFills[track.color] || "fill-primary")}
                      />
                    </svg>
                  </motion.div>
                ))}
              </div>

              {/* Playhead */}
              <div 
                className="absolute top-0 bottom-0 w-[2px] bg-primary z-30 shadow-[0_0_12px_rgba(var(--primary),1)] pointer-events-none"
                style={{ left: `${(playhead / (track?.duration || 40)) * 100 * zoom}%` }}
              >
                <div className="absolute top-0 -translate-x-1/2 w-4 h-4 bg-primary flex items-center justify-center">
                   <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-black mt-1" />
                </div>
              </div>
            </div>

            {/* Effects Rack - Ableton Device View Style */}
            <div className="h-[280px] bg-[#1f1f21] border-t border-white/10 flex shrink-0">
              {/* Rack Header/Browser */}
              <div className="w-56 bg-[#151516] border-r border-white/5 flex flex-col text-sm">
                <div className="p-3 border-b border-white/5 font-semibold text-white/90 bg-[#1c1c1e] text-xs uppercase tracking-wider">Audio Effects</div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {EFFECTS.map(eff => (
                    <button
                      key={eff.id}
                      onClick={() => addEffect(eff)}
                      className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded flex items-center justify-between group transition-colors"
                    >
                      <span className="flex items-center gap-2"><eff.icon className="w-3.5 h-3.5" /> {eff.name}</span>
                      <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-primary" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Devices Area */}
              <div className="flex-1 flex overflow-x-auto custom-scrollbar p-3 gap-3 bg-[#252528] items-center shadow-[inset_0_4px_20px_rgba(0,0,0,0.2)]">
                {activeEffects.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                    <SlidersHorizontal className="w-12 h-12 mb-3" />
                    <p className="text-sm font-medium">Click effects on the left to build your signal chain</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {activeEffects.map((eff, index) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={eff.id} 
                        className="bg-[#2d2d30] border border-white/10 rounded-lg shrink-0 flex flex-col shadow-xl overflow-hidden h-full min-w-[200px]"
                      >
                        <div className="bg-[#1f1f21] px-3 py-2 flex items-center justify-between border-b border-black/50 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shadow-inner">
                              <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                            </div>
                            <span className="text-xs font-bold text-white/90">{eff.name}</span>
                          </div>
                          <button onClick={() => removeEffect(eff.id)} className="text-white/40 hover:text-red-400 transition-colors p-1 hover:bg-white/5 rounded">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="p-4 flex flex-wrap gap-4 h-full items-start justify-center overflow-y-auto custom-scrollbar">
                          {eff.params.map(p => (
                            <Knob 
                              key={p.name}
                              label={p.name}
                              min={p.min}
                              max={p.max}
                              value={eff.paramValues[p.name]}
                              onChange={(v) => updateEffectParam(eff.id, p.name, v)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}