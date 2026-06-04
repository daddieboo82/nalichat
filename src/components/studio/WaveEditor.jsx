import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  X, Play, Pause, Scissors, Copy, Trash2, 
  Activity, Radio, Waves, Settings2, SlidersHorizontal,
  VolumeX, Volume2, Save, Wand2, Plus, MousePointer2, MoveHorizontal, Crosshair, Loader2, Undo2, Redo2, Maximize2, SplitSquareHorizontal, Magnet, SquareDashedBottom
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
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [selectionRange, setSelectionRange] = useState(null);
  const [isDraggingRange, setIsDraggingRange] = useState(false);

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

  const handleGainChange = (id, newGain) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, gain: newGain } : s));
  };

  const commitSegmentChange = () => {
    setSegments(prev => { saveHistory(prev); return prev; });
  };

  const handlePointerDown = (e) => {
    const segmentEl = e.target.closest('.audio-segment');
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
      const totalWidth = rect.width * zoom;
      let clickTime = (clickX / totalWidth) * (track?.duration || 40);
      clickTime = getSnappedTime(clickTime);

      if (activeTool === 'range' || (activeTool === 'select' && !segmentEl)) {
        setIsDraggingRange(true);
        setSelectionRange({ start: clickTime, end: clickTime });
        if (activeTool === 'select') setPlayhead(clickTime);
        return;
      }

      if (segmentEl && activeTool === 'move') return;

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
        if (clickedSegId) setSelectedSegmentId(clickedSegId);
        else setSelectedSegmentId(null);
        setSelectionRange(null);
      }
    }
  };

  const handlePointerMove = (e) => {
    if (isDraggingRange && (activeTool === 'range' || activeTool === 'select') && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
      const totalWidth = rect.width * zoom;
      let currentTime = (clickX / totalWidth) * (track?.duration || 40);
      currentTime = getSnappedTime(currentTime);
      setSelectionRange(prev => prev ? { ...prev, end: currentTime } : null);
    }
  };

  const handlePointerUp = () => {
    if (isDraggingRange) {
      setIsDraggingRange(false);
      setSelectionRange(prev => {
        if (!prev || prev.start === prev.end) return null;
        return { start: Math.min(prev.start, prev.end), end: Math.max(prev.start, prev.end) };
      });
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

  const handleRangeDelete = () => {
    if (!selectionRange) return;
    const { start, end } = selectionRange;
    setSegments(prev => {
        let newSegs = [];
        prev.forEach(seg => {
            const segEnd = seg.startOffset + seg.duration;
            if (segEnd <= start || seg.startOffset >= end) {
                newSegs.push(seg);
            } else if (seg.startOffset < start && segEnd > end) {
                const ratio1 = (start - seg.startOffset) / seg.duration;
                const ratio2 = (end - seg.startOffset) / seg.duration;
                const sEnd1 = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio1;
                const sStart2 = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio2;
                newSegs.push({ ...seg, id: `seg_${Date.now()}_1_${seg.id}`, sourceEnd: sEnd1, duration: start - seg.startOffset, waveform: seg.waveform.slice(0, Math.floor(seg.waveform.length * ratio1)) });
                newSegs.push({ ...seg, id: `seg_${Date.now()}_2_${seg.id}`, startOffset: end, sourceStart: sStart2, duration: segEnd - end, waveform: seg.waveform.slice(Math.floor(seg.waveform.length * ratio2)) });
            } else if (seg.startOffset < start && segEnd <= end) {
                const ratio = (start - seg.startOffset) / seg.duration;
                const sEnd = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio;
                newSegs.push({ ...seg, sourceEnd: sEnd, duration: start - seg.startOffset, waveform: seg.waveform.slice(0, Math.floor(seg.waveform.length * ratio)) });
            } else if (seg.startOffset >= start && segEnd > end) {
                const ratio = (end - seg.startOffset) / seg.duration;
                const sStart = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio;
                newSegs.push({ ...seg, startOffset: end, sourceStart: sStart, duration: segEnd - end, waveform: seg.waveform.slice(Math.floor(seg.waveform.length * ratio)) });
            }
        });
        saveHistory(newSegs);
        setSelectionRange(null);
        return newSegs;
    });
  };

  const handleRangeSplit = () => {
    if (!selectionRange) return;
    const { start, end } = selectionRange;
    setSegments(prev => {
        let newSegs = [];
        prev.forEach(seg => {
            const segEnd = seg.startOffset + seg.duration;
            if (segEnd <= start || seg.startOffset >= end) {
                newSegs.push(seg);
            } else if (seg.startOffset < start && segEnd > end) {
                const ratio1 = (start - seg.startOffset) / seg.duration;
                const ratio2 = (end - seg.startOffset) / seg.duration;
                const sEnd1 = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio1;
                const sStart2 = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio2;
                newSegs.push({ ...seg, id: `seg_${Date.now()}_1_${seg.id}`, sourceEnd: sEnd1, duration: start - seg.startOffset, waveform: seg.waveform.slice(0, Math.floor(seg.waveform.length * ratio1)) });
                newSegs.push({ ...seg, id: `seg_${Date.now()}_mid_${seg.id}`, startOffset: start, sourceStart: sEnd1, sourceEnd: sStart2, duration: end - start, waveform: seg.waveform.slice(Math.floor(seg.waveform.length * ratio1), Math.floor(seg.waveform.length * ratio2)) });
                newSegs.push({ ...seg, id: `seg_${Date.now()}_2_${seg.id}`, startOffset: end, sourceStart: sStart2, duration: segEnd - end, waveform: seg.waveform.slice(Math.floor(seg.waveform.length * ratio2)) });
            } else if (seg.startOffset < start && segEnd <= end) {
                const ratio = (start - seg.startOffset) / seg.duration;
                const sEnd = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio;
                newSegs.push({ ...seg, id: `seg_${Date.now()}_1_${seg.id}`, sourceEnd: sEnd, duration: start - seg.startOffset, waveform: seg.waveform.slice(0, Math.floor(seg.waveform.length * ratio)) });
                newSegs.push({ ...seg, id: `seg_${Date.now()}_2_${seg.id}`, startOffset: start, sourceStart: sEnd, duration: segEnd - start, waveform: seg.waveform.slice(Math.floor(seg.waveform.length * ratio)) });
            } else if (seg.startOffset >= start && segEnd > end) {
                const ratio = (end - seg.startOffset) / seg.duration;
                const sStart = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio;
                newSegs.push({ ...seg, id: `seg_${Date.now()}_1_${seg.id}`, sourceEnd: sStart, duration: end - seg.startOffset, waveform: seg.waveform.slice(0, Math.floor(seg.waveform.length * ratio)) });
                newSegs.push({ ...seg, id: `seg_${Date.now()}_2_${seg.id}`, startOffset: end, sourceStart: sStart, duration: segEnd - end, waveform: seg.waveform.slice(Math.floor(seg.waveform.length * ratio)) });
            }
        });
        saveHistory(newSegs);
        setSelectionRange(null);
        return newSegs;
    });
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
        if (selectionRange) {
           handleRangeDelete();
        } else {
            setSegments(prev => {
              if (!selectedSegmentId) return prev;
              const newSegs = prev.filter(s => s.id !== selectedSegmentId);
              saveHistory(newSegs);
              setSelectedSegmentId(null);
              return newSegs;
            });
        }
      } else if (e.code === 'Digit1') {
        setActiveTool('select');
      } else if (e.code === 'Digit2') {
        setActiveTool('move');
      } else if (e.code === 'Digit3') {
        setActiveTool('split');
      } else if (e.code === 'Digit4') {
        setActiveTool('range');
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
                <Button variant="ghost" size="icon" onClick={() => setActiveTool('range')} className={cn("h-6 w-6 rounded", activeTool === 'range' && "bg-primary/20 text-primary")} title="Time Range Selection (Shortcut: 4)">
                  <SquareDashedBottom className="w-3.5 h-3.5" />
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
              className="flex-1 relative bg-[#151516] overflow-x-auto overflow-y-hidden custom-scrollbar focus:outline-none touch-none" 
              ref={containerRef} 
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
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

              {/* Range Selection Overlay */}
              {selectionRange && (
                <>
                <div 
                  className="absolute top-8 bottom-4 bg-blue-500/20 border-l border-r border-blue-500 pointer-events-none z-20"
                  style={{
                    left: `${(Math.min(selectionRange.start, selectionRange.end) / (track?.duration || 40)) * 100 * zoom}%`,
                    width: `${(Math.abs(selectionRange.end - selectionRange.start) / (track?.duration || 40)) * 100 * zoom}%`
                  }}
                >
                  <div className="absolute top-1 left-1 bg-blue-500 text-white text-[9px] px-1 rounded shadow">
                    {(Math.abs(selectionRange.end - selectionRange.start)).toFixed(2)}s
                  </div>
                </div>

                {/* Floating Context Menu */}
                {!isDraggingRange && Math.abs(selectionRange.end - selectionRange.start) > 0.05 && (
                  <div 
                    className="absolute top-2 z-50 flex items-center gap-1 bg-[#252528] p-1 rounded-md shadow-2xl border border-white/10"
                    style={{
                       left: `${((Math.min(selectionRange.start, selectionRange.end) + Math.abs(selectionRange.end - selectionRange.start)/2) / (track?.duration || 40)) * 100 * zoom}%`,
                       transform: 'translateX(-50%)'
                    }}
                  >
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-white/80 hover:text-white px-2 gap-1" onClick={(e) => { e.stopPropagation(); handleRangeSplit(); }}>
                      <Scissors className="w-3 h-3" /> Split
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2 gap-1" onClick={(e) => { e.stopPropagation(); handleRangeDelete(); }}>
                      <Trash2 className="w-3 h-3" /> Delete
                    </Button>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/50 hover:text-white" onClick={(e) => { e.stopPropagation(); setSelectionRange(null); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                </>
              )}

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
                    <div className="absolute top-0 left-0 right-0 h-5 bg-black/40 flex items-center px-2 group-hover:bg-primary/20 transition-colors z-20 pointer-events-none">
                      <span className="text-[10px] text-white/80 font-mono truncate">{track.name} [{idx+1}]</span>
                    </div>

                    {/* Left Trim Handle */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 cursor-col-resize hover:bg-white/30 z-30 transition-all flex items-center justify-center group/triml"
                      title="Trim Start"
                      onPointerDown={(e) => {
                          if (activeTool !== 'select') return;
                          e.stopPropagation();
                          const rect = containerRef.current.getBoundingClientRect();
                          const totalWidth = rect.width * zoom;
                          const initialSeg = { ...seg };
                          const handleMove = (moveEv) => {
                              const clickX = moveEv.clientX - rect.left + containerRef.current.scrollLeft;
                              let newStart = (clickX / totalWidth) * (track?.duration || 40);
                              newStart = getSnappedTime(Math.max(0, Math.min(newStart, initialSeg.startOffset + initialSeg.duration - 0.1)));
                              
                              const timeDiff = newStart - initialSeg.startOffset;
                              const ratio = timeDiff / initialSeg.duration;
                              const newSourceStart = initialSeg.sourceStart + (initialSeg.sourceEnd - initialSeg.sourceStart) * ratio;
                              
                              setSegments(prev => prev.map(s => {
                                  if (s.id === initialSeg.id) {
                                      return {
                                          ...s,
                                          startOffset: newStart,
                                          sourceStart: newSourceStart,
                                          duration: initialSeg.duration - timeDiff,
                                          waveform: initialSeg.waveform.slice(Math.max(0, Math.floor(initialSeg.waveform.length * ratio))),
                                          fadeIn: s.fadeIn ? Math.max(0, s.fadeIn - timeDiff) : 0
                                      };
                                  }
                                  return s;
                              }));
                          };
                          const handleUp = () => {
                              window.removeEventListener('pointermove', handleMove);
                              window.removeEventListener('pointerup', handleUp);
                              commitSegmentChange();
                          };
                          window.addEventListener('pointermove', handleMove);
                          window.addEventListener('pointerup', handleUp);
                      }}
                    >
                      <div className="w-[2px] h-4 bg-white/50 rounded-full group-hover/triml:bg-white" />
                    </div>

                    {/* Right Trim Handle */}
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 cursor-col-resize hover:bg-white/30 z-30 transition-all flex items-center justify-center group/trimr"
                      title="Trim End"
                      onPointerDown={(e) => {
                          if (activeTool !== 'select') return;
                          e.stopPropagation();
                          const rect = containerRef.current.getBoundingClientRect();
                          const totalWidth = rect.width * zoom;
                          const initialSeg = { ...seg };
                          const handleMove = (moveEv) => {
                              const clickX = moveEv.clientX - rect.left + containerRef.current.scrollLeft;
                              let newEnd = (clickX / totalWidth) * (track?.duration || 40);
                              newEnd = getSnappedTime(Math.max(initialSeg.startOffset + 0.1, Math.min(newEnd, track?.duration || 40)));
                              
                              const newDuration = newEnd - initialSeg.startOffset;
                              const ratio = newDuration / initialSeg.duration;
                              const newSourceEnd = initialSeg.sourceStart + (initialSeg.sourceEnd - initialSeg.sourceStart) * ratio;
                              
                              setSegments(prev => prev.map(s => {
                                  if (s.id === initialSeg.id) {
                                      return {
                                          ...s,
                                          sourceEnd: newSourceEnd,
                                          duration: newDuration,
                                          waveform: initialSeg.waveform.slice(0, Math.max(1, Math.floor(initialSeg.waveform.length * ratio))),
                                          fadeOut: s.fadeOut ? Math.max(0, s.fadeOut - (initialSeg.duration - newDuration)) : 0
                                      };
                                  }
                                  return s;
                              }));
                          };
                          const handleUp = () => {
                              window.removeEventListener('pointermove', handleMove);
                              window.removeEventListener('pointerup', handleUp);
                              commitSegmentChange();
                          };
                          window.addEventListener('pointermove', handleMove);
                          window.addEventListener('pointerup', handleUp);
                      }}
                    >
                      <div className="w-[2px] h-4 bg-white/50 rounded-full group-hover/trimr:bg-white" />
                    </div>

                    {/* Gain Line */}
                    <div 
                        className="absolute left-0 right-0 h-2 -mt-1 cursor-ns-resize hover:bg-white/30 z-20 group/gain flex items-center justify-center transition-colors"
                        style={{ top: `${Math.max(5, Math.min(95, (1 - (seg.gain ?? 1)) * 50 + 50))}%` }}
                        onPointerDown={(e) => {
                            if (activeTool !== 'select') return;
                            e.stopPropagation();
                            const startY = e.clientY;
                            const startGain = seg.gain ?? 1;
                            const handleMove = (moveEv) => {
                                const deltaY = moveEv.clientY - startY;
                                const newGain = Math.max(0, Math.min(2, startGain - deltaY / 50));
                                handleGainChange(seg.id, newGain);
                            };
                            const handleUp = () => {
                                window.removeEventListener('pointermove', handleMove);
                                window.removeEventListener('pointerup', handleUp);
                                commitSegmentChange();
                            };
                            window.addEventListener('pointermove', handleMove);
                            window.addEventListener('pointerup', handleUp);
                        }}
                    >
                        <div className="w-full h-px bg-white/40 group-hover/gain:bg-white" />
                        <div className="hidden group-hover/gain:block absolute -top-6 bg-black text-white text-[10px] px-1.5 py-0.5 rounded shadow">
                           {((seg.gain ?? 1) * 100).toFixed(0)}%
                        </div>
                    </div>

                    {/* Fades */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
                      {seg.fadeIn && (
                        <polygon points={`0,0 ${((seg.fadeIn)/(seg.duration))*100}%,0 0,100%`} className="fill-[#1c1c1e]/90" />
                      )}
                      {seg.fadeOut && (
                        <polygon points={`100%,0 ${100 - ((seg.fadeOut)/(seg.duration))*100}%,0 100%,100%`} className="fill-[#1c1c1e]/90" />
                      )}
                    </svg>

                    {/* Fade Handles */}
                    <div 
                        className="absolute top-0 w-4 h-4 bg-white/80 hover:bg-white hover:scale-110 cursor-ew-resize z-40 rounded-br-lg shadow-sm transition-transform flex items-center justify-center group/fadein"
                        style={{ left: `${((seg.fadeIn || 0) / seg.duration) * 100}%` }}
                        title="Fade In"
                        onPointerDown={(e) => {
                            if (activeTool !== 'select') return;
                            e.stopPropagation();
                            const rect = e.target.parentElement.getBoundingClientRect();
                            const handleMove = (moveEv) => {
                                const clickX = Math.max(0, moveEv.clientX - rect.left);
                                const newFadeIn = (clickX / rect.width) * seg.duration;
                                setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, fadeIn: Math.min(newFadeIn, seg.duration - (seg.fadeOut || 0)) } : s));
                            };
                            const handleUp = () => {
                                window.removeEventListener('pointermove', handleMove);
                                window.removeEventListener('pointerup', handleUp);
                                commitSegmentChange();
                            };
                            window.addEventListener('pointermove', handleMove);
                            window.addEventListener('pointerup', handleUp);
                        }}
                    >
                      <div className="w-[6px] h-[6px] bg-black/30 rounded-full group-hover/fadein:bg-black/50" />
                    </div>
                    <div 
                        className="absolute top-0 w-4 h-4 bg-white/80 hover:bg-white hover:scale-110 cursor-ew-resize z-40 rounded-bl-lg shadow-sm transition-transform -translate-x-full flex items-center justify-center group/fadeout"
                        style={{ left: `${100 - ((seg.fadeOut || 0) / seg.duration) * 100}%` }}
                        title="Fade Out"
                        onPointerDown={(e) => {
                            if (activeTool !== 'select') return;
                            e.stopPropagation();
                            const rect = e.target.parentElement.getBoundingClientRect();
                            const handleMove = (moveEv) => {
                                const clickX = Math.max(0, rect.right - moveEv.clientX);
                                const newFadeOut = (clickX / rect.width) * seg.duration;
                                setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, fadeOut: Math.min(newFadeOut, seg.duration - (seg.fadeIn || 0)) } : s));
                            };
                            const handleUp = () => {
                                window.removeEventListener('pointermove', handleMove);
                                window.removeEventListener('pointerup', handleUp);
                                commitSegmentChange();
                            };
                            window.addEventListener('pointermove', handleMove);
                            window.addEventListener('pointerup', handleUp);
                        }}
                    >
                      <div className="w-[6px] h-[6px] bg-black/30 rounded-full group-hover/fadeout:bg-black/50" />
                    </div>

                    {/* Waveform */}
                    <svg className="w-full h-full pt-5 pb-1 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 1000 100">
                      <path 
                        d={(() => {
                          const wf = seg.waveform || [];
                          const wLen = wf.length - 1 || 1;
                          let d = `M 0,50 `;
                          for(let i=0; i<=wLen; i++) d += `L ${(i/wLen)*1000},${50 - Math.max(0.02, wf[i])*45*(seg.gain ?? 1)} `;
                          for(let i=wLen; i>=0; i--) d += `L ${(i/wLen)*1000},${50 + Math.max(0.02, wf[i])*45*(seg.gain ?? 1)} `;
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
                className={cn(
                  "absolute top-0 bottom-0 z-30 cursor-ew-resize transition-colors",
                  isDraggingPlayhead ? "w-[3px] bg-white shadow-[0_0_15px_rgba(255,255,255,1)]" : "w-[2px] bg-primary shadow-[0_0_12px_rgba(var(--primary),1)]"
                )}
                style={{ left: `${(playhead / (track?.duration || 40)) * 100 * zoom}%` }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingPlayhead(true);
                  const handleMove = (moveEvent) => {
                     const rect = containerRef.current.getBoundingClientRect();
                     const clickX = moveEvent.clientX - rect.left + containerRef.current.scrollLeft;
                     const totalWidth = rect.width * zoom;
                     let newTime = (clickX / totalWidth) * (track?.duration || 40);
                     newTime = getSnappedTime(Math.max(0, Math.min(newTime, track?.duration || 40)));
                     setPlayhead(newTime);
                  };
                  const handleUp = () => {
                     setIsDraggingPlayhead(false);
                     window.removeEventListener('pointermove', handleMove);
                     window.removeEventListener('pointerup', handleUp);
                  };
                  window.addEventListener('pointermove', handleMove);
                  window.addEventListener('pointerup', handleUp);
                }}
              >
                <div className={cn(
                  "absolute top-0 -translate-x-1/2 w-4 h-4 flex items-center justify-center transition-colors",
                  isDraggingPlayhead ? "bg-white" : "bg-primary"
                )}>
                   <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-black mt-1" />
                </div>
                <div className={cn(
                  "absolute top-5 -translate-x-1/2 text-black text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shadow-lg transition-all",
                  isDraggingPlayhead ? "bg-white scale-110" : "bg-primary scale-100"
                )}>
                  {playhead.toFixed(3)}s
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