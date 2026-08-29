import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  X, Play, Pause, Scissors, Copy, Trash2, 
  Activity, Radio, Waves, Settings2, SlidersHorizontal,
  VolumeX, Volume2, Save, Wand2, Plus, MousePointer2, MoveHorizontal, Crosshair, Loader2, Undo2, Redo2, Maximize2, SplitSquareHorizontal, Magnet, SquareDashedBottom,
  FileText, FolderOpen, SkipBack, Rewind, Square, FastForward, SkipForward, Circle, ZoomIn, ZoomOut, ChevronDown,
  Sparkles, Speaker, Mic, Disc, Ear, Cpu, AudioLines, Gauge, AudioWaveform, Zap, Music, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Knob } from '@/components/ui/knob';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuShortcut
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const waveformFills = {
  "bg-primary": "fill-primary",
  "bg-pink-500": "fill-pink-500",
  "bg-accent": "fill-accent",
  "bg-yellow-500": "fill-yellow-500",
  "bg-purple-500": "fill-purple-500",
  "bg-green-500": "fill-green-500"
};

const EFFECTS = [
  // EQs
  { id: 'eq_eight', name: 'Pro EQ Eight', icon: SlidersHorizontal, params: [{name: 'Low', min: -15, max: 15}, {name: 'Mid', min: -15, max: 15}, {name: 'High', min: -15, max: 15}, {name: 'Freq', min: 20, max: 20000}] },
  { id: 'eq_analog_73', name: 'Analog EQ 73', icon: SlidersHorizontal, params: [{name: 'Low Shelf', min: -15, max: 15}, {name: 'Presence', min: -15, max: 15}, {name: 'High Shelf', min: -15, max: 15}, {name: 'Drive', min: 0, max: 100}] },
  { id: 'eq_console_g', name: 'British Console EQ', icon: SlidersHorizontal, params: [{name: 'LF', min: -15, max: 15}, {name: 'LMF', min: -15, max: 15}, {name: 'HMF', min: -15, max: 15}, {name: 'HF', min: -15, max: 15}] },
  { id: 'eq_american_5a', name: 'American EQ 5A', icon: SlidersHorizontal, params: [{name: '50Hz', min: -12, max: 12}, {name: '1.5kHz', min: -12, max: 12}, {name: '10kHz', min: -12, max: 12}] },
  
  // Compressors & Dynamics
  { id: 'comp_opto_2a', name: 'Opto Comp 2A', icon: Radio, params: [{name: 'Peak Reduction', min: 0, max: 100}, {name: 'Gain', min: 0, max: 100}] },
  { id: 'comp_fet_76', name: 'FET Comp 76', icon: Radio, params: [{name: 'Input', min: 0, max: 100}, {name: 'Output', min: 0, max: 100}, {name: 'Attack', min: 1, max: 7}, {name: 'Release', min: 1, max: 7}] },
  { id: 'comp_tube_670', name: 'Tube Comp 670', icon: Radio, params: [{name: 'Threshold', min: 0, max: 10}, {name: 'Time Const', min: 1, max: 6}, {name: 'Input Gain', min: -20, max: 20}] },
  { id: 'comp_bus_g', name: 'Console Bus Comp', icon: Radio, params: [{name: 'Thresh', min: -20, max: 20}, {name: 'Makeup', min: -5, max: 15}, {name: 'Ratio', min: 2, max: 10}, {name: 'Release', min: 100, max: 1200}] },
  { id: 'comp_multiband_x6', name: 'Multiband Dynamics X6', icon: AudioWaveform, params: [{name: 'Low Thresh', min: -60, max: 0}, {name: 'Mid Thresh', min: -60, max: 0}, {name: 'High Thresh', min: -60, max: 0}, {name: 'Crossover', min: 100, max: 5000}] },
  { id: 'gate_c1', name: 'Noise Gate C1', icon: Activity, params: [{name: 'Threshold', min: -80, max: 0}, {name: 'Floor', min: -80, max: 0}, {name: 'Attack', min: 0.1, max: 100}, {name: 'Release', min: 10, max: 1000}] },
  { id: 'transient_shaper', name: 'Transient Shaper', icon: Zap, params: [{name: 'Attack', min: -100, max: 100}, {name: 'Sustain', min: -100, max: 100}, {name: 'Output', min: -24, max: 24}] },

  // Vocal Specific
  { id: 'vocal_leveler', name: 'Vocal Auto-Leveler', icon: Mic, params: [{name: 'Target', min: -24, max: 0}, {name: 'Sensitivity', min: 0, max: 100}, {name: 'Speed', min: 0, max: 100}] },
  { id: 'vocal_deesser', name: 'Sibilance Control', icon: Mic, params: [{name: 'Freq', min: 2000, max: 12000}, {name: 'Threshold', min: -60, max: 0}, {name: 'Range', min: -24, max: 0}] },
  { id: 'vocal_tune_rt', name: 'Auto-Pitch Realtime', icon: Music, params: [{name: 'Speed', min: 0, max: 100}, {name: 'Note Trans', min: 0, max: 100}, {name: 'Formant', min: 0, max: 100}] },
  { id: 'vocal_doubler', name: 'Vocal Doubler', icon: Ear, params: [{name: 'Voices', min: 1, max: 4}, {name: 'Detune', min: 0, max: 50}, {name: 'Delay', min: 0, max: 100}, {name: 'Mix', min: 0, max: 100}] },
  { id: 'vocal_smooth', name: 'Vocal Smooth Vox', icon: Mic, params: [{name: 'Comp', min: 0, max: 100}, {name: 'Gate', min: -80, max: 0}, {name: 'Gain', min: -18, max: 18}] },

  // Reverbs
  { id: 'verb_lush_plate', name: 'Lush Plate Reverb', icon: Waves, params: [{name: 'Decay', min: 0.5, max: 10}, {name: 'Pre-Delay', min: 0, max: 200}, {name: 'Damping', min: 0, max: 100}, {name: 'Mix', min: 0, max: 100}] },
  { id: 'verb_true_room', name: 'True Room Reverb', icon: Waves, params: [{name: 'Size', min: 1, max: 100}, {name: 'Distance', min: 1, max: 100}, {name: 'Decay', min: 0.1, max: 5}, {name: 'Mix', min: 0, max: 100}] },
  { id: 'verb_convolution', name: 'Convolution Space', icon: Waves, params: [{name: 'Impulse', min: 1, max: 50}, {name: 'Size', min: 50, max: 150}, {name: 'Mix', min: 0, max: 100}] },

  // Delays
  { id: 'delay_hybrid', name: 'Hybrid Delay', icon: Activity, params: [{name: 'Time', min: 1, max: 2000}, {name: 'Feedback', min: 0, max: 100}, {name: 'Mod Depth', min: 0, max: 100}, {name: 'Mix', min: 0, max: 100}] },
  { id: 'delay_slapback', name: 'Vintage Slapback', icon: Activity, params: [{name: 'Time', min: 40, max: 150}, {name: 'Tape Age', min: 0, max: 100}, {name: 'Mix', min: 0, max: 100}] },
  { id: 'delay_pingpong', name: 'Ping Pong Echo', icon: Activity, params: [{name: 'Time L', min: 1, max: 2000}, {name: 'Time R', min: 1, max: 2000}, {name: 'Feedback', min: 0, max: 100}, {name: 'Mix', min: 0, max: 100}] },

  // Saturation & Tape
  { id: 'tape_machine', name: 'Analog Tape Machine', icon: Disc, params: [{name: 'Drive', min: 0, max: 10}, {name: 'Wow/Flutter', min: 0, max: 100}, {name: 'Noise', min: -80, max: -20}, {name: 'Bias', min: 0, max: 100}] },
  { id: 'tube_saturator', name: 'Studio Tube Saturation', icon: Wand2, params: [{name: 'Drive', min: 0, max: 100}, {name: 'Tone', min: 0, max: 100}, {name: 'Character', min: 1, max: 3}, {name: 'Mix', min: 0, max: 100}] },
  { id: 'lofi_bitcrusher', name: 'Lo-Fi Bitcrusher', icon: Cpu, params: [{name: 'Bits', min: 2, max: 24}, {name: 'Sample Rate', min: 100, max: 44100}, {name: 'Drive', min: 0, max: 100}] },

  // Modulation & Pitch
  { id: 'mod_enigma', name: 'Enigmatic Modulator', icon: AudioLines, params: [{name: 'Depth', min: 0, max: 100}, {name: 'Rate', min: 0.1, max: 20}, {name: 'Feedback', min: 0, max: 100}, {name: 'Mix', min: 0, max: 100}] },
  { id: 'mod_metaflanger', name: 'Meta Phase/Flange', icon: AudioLines, params: [{name: 'Rate', min: 0.1, max: 20}, {name: 'Depth', min: 0, max: 100}, {name: 'Feedback', min: -100, max: 100}, {name: 'Mix', min: 0, max: 100}] },
  { id: 'mod_mondo', name: 'Mondo Chorus', icon: AudioLines, params: [{name: 'AM Depth', min: 0, max: 100}, {name: 'FM Depth', min: 0, max: 100}, {name: 'Rate', min: 0.1, max: 20}, {name: 'Mix', min: 0, max: 100}] },

  // Enhancement & Spatial
  { id: 'enhancer_harmonic', name: 'Harmonic Exciter', icon: Sparkles, params: [{name: 'Lows', min: 0, max: 100}, {name: 'Mids', min: 0, max: 100}, {name: 'Highs', min: 0, max: 100}, {name: 'Punch', min: 0, max: 100}] },
  { id: 'enhancer_sub', name: 'Sub Bass Generator', icon: Speaker, params: [{name: 'Freq', min: 20, max: 120}, {name: 'Intensity', min: 0, max: 100}, {name: 'Harmonics', min: 0, max: 100}] },
  { id: 'stereo_widener', name: 'Stereo Widener', icon: Ear, params: [{name: 'Width', min: 0, max: 300}, {name: 'Asymmetry', min: -100, max: 100}, {name: 'Rotation', min: -100, max: 100}] },

  // Mastering
  { id: 'master_apex_limiter', name: 'Apex Peak Limiter', icon: Gauge, params: [{name: 'Threshold', min: -30, max: 0}, {name: 'Out Ceiling', min: -30, max: 0}, {name: 'Release', min: 0.1, max: 1000}, {name: 'Dither', min: 0, max: 1}] },
];

export default function WaveEditor({ track, onClose, onSave }) {
  const isMobile = useIsMobile();
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
  const [pendingStart, setPendingStart] = useState(null); // click-to-select: first click marker
  const [activeEnvelope, setActiveEnvelope] = useState(null);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
  const [collapsedEffects, setCollapsedEffects] = useState({});
  const [effectSearch, setEffectSearch] = useState('');

  const toggleCollapseEffect = (id) => {
    setCollapsedEffects(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const containerRef = useRef(null);
  const effectsContainerRef = useRef(null);

  useEffect(() => {
    if (effectsContainerRef.current) {
      setTimeout(() => {
        if (effectsContainerRef.current) {
          effectsContainerRef.current.scrollTo({
            left: effectsContainerRef.current.scrollWidth,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [activeEffects.length]);

  const getEnv = (seg, type) => {
    if (seg[type]) return seg[type];
    return type === 'panEnv' ? [{t:0, v:0.5}, {t:1, v:0.5}] : [{t:0, v:1}, {t:1, v:1}];
  };

  const getSnappedTime = (time) => {
    if (!snapToGrid) return time;
    const snapInterval = zoom > 200 ? 0.001 : zoom > 50 ? 0.01 : zoom > 10 ? 0.05 : zoom > 5 ? 0.1 : zoom > 2 ? 0.5 : 1;
    return Math.round(time / snapInterval) * snapInterval;
  };

  // Initialize segments
  useEffect(() => {
    if (track && segments.length === 0) {
      let loadedAutosave = false;
      try {
        const saved = localStorage.getItem('nalistudio_waveeditor_autosave');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.trackId === track.id) {
            setSegments(parsed.segments);
            setHistory([parsed.segments]);
            setHistoryIdx(0);
            setActiveEffects(parsed.activeEffects || []);
            loadedAutosave = true;
          }
        }
      } catch (e) {
        console.error("Failed to load autosave", e);
      }

      if (!loadedAutosave) {
        const initialSegs = track.segments && track.segments.length > 0 ? track.segments : [{
          id: `seg_${Date.now()}`,
          startOffset: 0, // time in track where this segment starts
          sourceStart: 0, // normalized 0-1
          sourceEnd: 1, // normalized 0-1
          duration: track.duration || 40,
          waveform: (track.waveform && track.waveform.length > 0) ? track.waveform : Array.from({length: 100}, () => 0.02)
        }];
        setSegments(initialSegs);
        setHistory([initialSegs]);
        setHistoryIdx(0);
        if (track.effects) setActiveEffects(track.effects);
      }
    }
  }, [track]);

  // Autosave when making changes
  useEffect(() => {
    if (track && segments.length > 0) {
      try {
        const stateToSave = { trackId: track.id, segments, activeEffects };
        localStorage.setItem('nalistudio_waveeditor_autosave', JSON.stringify(stateToSave));
      } catch (e) {
        console.error("Failed to autosave", e);
      }
    }
  }, [segments, activeEffects, track]);

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
      const clickY = e.clientY - rect.top;
      const isRulerClick = clickY <= 24;

      const totalWidth = rect.width * zoom;
      let clickTime = (clickX / totalWidth) * (track?.duration || 40);
      clickTime = getSnappedTime(clickTime);

      if (isRulerClick) {
        setPlayhead(clickTime);
        return;
      }

      if (activeTool === 'range' || (activeTool === 'select' && !segmentEl)) {
        if (activeTool === 'select') {
          // Click-to-select: first click sets start marker, second click sets end
          if (pendingStart === null) {
            setPendingStart(clickTime);
            setSelectionRange(null);
            setPlayhead(clickTime);
            return;
          } else {
            const start = Math.min(pendingStart, clickTime);
            const end = Math.max(pendingStart, clickTime);
            if (end - start > 0.001) {
              setSelectionRange({ start, end });
            }
            setPendingStart(null);
            return;
          }
        }
        // Range tool: drag to select (original behavior)
        setIsDraggingRange(true);
        setSelectionRange({ start: clickTime, end: clickTime });
        setPlayhead(clickTime);
        return;
      }

      // Clicking on a segment cancels any pending selection start
      if (pendingStart !== null) setPendingStart(null);

      if (segmentEl && activeTool === 'move') return;

      const clickedSegId = segmentEl ? segmentEl.dataset.segmentId : null;

      if (activeTool === 'split') {
        const segIndex = segments.findIndex(s => clickTime > s.startOffset && clickTime < (s.startOffset + s.duration));
        if (segIndex !== -1) {
          const seg = segments[segIndex];
          const splitRatio = (clickTime - seg.startOffset) / seg.duration;
          const splitSourceTime = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * splitRatio;
          
          const newSeg1 = { ...seg, id: `seg_${Date.now()}_1`, sourceEnd: splitSourceTime, duration: seg.duration * splitRatio, waveform: seg.waveform };
          const newSeg2 = { ...seg, id: `seg_${Date.now()}_2`, startOffset: clickTime, sourceStart: splitSourceTime, duration: seg.duration * (1 - splitRatio), waveform: seg.waveform };

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
    toast.success(`${effect.name} added to rack`);
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
                newSegs.push({ ...seg, id: `seg_${Date.now()}_1_${seg.id}`, sourceEnd: sEnd1, duration: start - seg.startOffset, waveform: seg.waveform });
                newSegs.push({ ...seg, id: `seg_${Date.now()}_2_${seg.id}`, startOffset: end, sourceStart: sStart2, duration: segEnd - end, waveform: seg.waveform });
            } else if (seg.startOffset < start && segEnd <= end) {
                const ratio = (start - seg.startOffset) / seg.duration;
                const sEnd = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio;
                newSegs.push({ ...seg, sourceEnd: sEnd, duration: start - seg.startOffset, waveform: seg.waveform });
            } else if (seg.startOffset >= start && segEnd > end) {
                const ratio = (end - seg.startOffset) / seg.duration;
                const sStart = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio;
                newSegs.push({ ...seg, startOffset: end, sourceStart: sStart, duration: segEnd - end, waveform: seg.waveform });
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
                newSegs.push({ ...seg, id: `seg_${Date.now()}_1_${seg.id}`, sourceEnd: sEnd1, duration: start - seg.startOffset, waveform: seg.waveform });
                newSegs.push({ ...seg, id: `seg_${Date.now()}_mid_${seg.id}`, startOffset: start, sourceStart: sEnd1, sourceEnd: sStart2, duration: end - start, waveform: seg.waveform });
                newSegs.push({ ...seg, id: `seg_${Date.now()}_2_${seg.id}`, startOffset: end, sourceStart: sStart2, duration: segEnd - end, waveform: seg.waveform });
            } else if (seg.startOffset < start && segEnd <= end) {
                const ratio = (start - seg.startOffset) / seg.duration;
                const sEnd = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio;
                newSegs.push({ ...seg, id: `seg_${Date.now()}_1_${seg.id}`, sourceEnd: sEnd, duration: start - seg.startOffset, waveform: seg.waveform });
                newSegs.push({ ...seg, id: `seg_${Date.now()}_2_${seg.id}`, startOffset: start, sourceStart: sEnd, duration: segEnd - start, waveform: seg.waveform });
            } else if (seg.startOffset >= start && segEnd > end) {
                const ratio = (end - seg.startOffset) / seg.duration;
                const sStart = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * ratio;
                newSegs.push({ ...seg, id: `seg_${Date.now()}_1_${seg.id}`, sourceEnd: sStart, duration: end - seg.startOffset, waveform: seg.waveform });
                newSegs.push({ ...seg, id: `seg_${Date.now()}_2_${seg.id}`, startOffset: end, sourceStart: sStart, duration: segEnd - end, waveform: seg.waveform });
            }
        });
        saveHistory(newSegs);
        setSelectionRange(null);
        return newSegs;
    });
  };

  // Apply fade in/out to segments overlapping the selection range
  const handleRangeFade = (direction) => {
    if (!selectionRange) return;
    const { start, end } = selectionRange;
    setSegments(prev => {
      let changed = false;
      const newSegs = prev.map(seg => {
        const segEnd = seg.startOffset + seg.duration;
        // Only apply to segments that overlap the selection
        if (segEnd <= start || seg.startOffset >= end) return seg;
        changed = true;
        if (direction === 'in') {
          // Fade in starts at selection start, duration = selection length
          return { ...seg, fadeIn: end - start };
        } else {
          return { ...seg, fadeOut: end - start };
        }
      });
      if (changed) {
        saveHistory(newSegs);
        toast.success(`Fade ${direction} applied to selection`);
      }
      return newSegs;
    });
  };

  // Mute segments overlapping the selection range (set gain to 0)
  const handleRangeMute = () => {
    if (!selectionRange) return;
    const { start, end } = selectionRange;
    setSegments(prev => {
      let changed = false;
      const newSegs = prev.map(seg => {
        const segEnd = seg.startOffset + seg.duration;
        if (segEnd <= start || seg.startOffset >= end) return seg;
        changed = true;
        return { ...seg, gain: 0 };
      });
      if (changed) {
        saveHistory(newSegs);
        toast.success("Selection muted");
      }
      return newSegs;
    });
  };

  const handleSave = () => {
    if (!track) return;
    try {
      localStorage.removeItem('nalistudio_waveeditor_autosave');
    } catch (e) {}
    onSave(track.id, { ...track, segments, effects: activeEffects });
    toast.success("Track edits saved successfully!");
  };

  const handleClose = () => {
    if (!track) { onClose(); return; }
    try {
      localStorage.removeItem('nalistudio_waveeditor_autosave');
    } catch (e) {}
    onSave(track.id, { ...track, segments, effects: activeEffects });
    onClose();
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
      // Escape always closes the editor — even from input fields, and even if a
      // selection is pending (no multi-step clearing needed). Sub-dialogs handle
      // their own Escape, so skip to avoid closing the editor underneath them.
      if (e.code === 'Escape') {
        if (showHelpDialog || showPreferencesDialog) return;
        e.preventDefault();
        handleClose();
        return;
      }
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.code === 'Backspace' || e.code === 'Delete') {
        if (pendingStart !== null) { setPendingStart(null); return; }
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
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyS') {
        e.preventDefault();
        handleSave();
      } else if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey) {
        setSegments(prev => {
          const segIndex = prev.findIndex(s => playhead > s.startOffset && playhead < (s.startOffset + s.duration));
          if (segIndex !== -1) {
            const seg = prev[segIndex];
            const splitRatio = (playhead - seg.startOffset) / seg.duration;
            const splitSourceTime = seg.sourceStart + (seg.sourceEnd - seg.sourceStart) * splitRatio;
            
            const newSeg1 = { ...seg, id: `seg_${Date.now()}_1`, sourceEnd: splitSourceTime, duration: seg.duration * splitRatio, waveform: seg.waveform };
            const newSeg2 = { ...seg, id: `seg_${Date.now()}_2`, startOffset: playhead, sourceStart: splitSourceTime, duration: seg.duration * (1 - splitRatio), waveform: seg.waveform };
            
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
  }, [historyIdx, history, selectedSegmentId, playhead, pendingStart, selectionRange, showHelpDialog, showPreferencesDialog]);

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
          className="bg-background text-foreground shadow-2xl rounded-xl w-full max-w-[1400px] h-[90vh] flex flex-col overflow-hidden ring-1 ring-border"
        >
          {/* Menu Bar - Studio Style */}
          <div className="flex items-center px-4 py-2 bg-card/80 backdrop-blur border-b border-border/50 text-xs text-foreground/90 shadow-sm shrink-0">
            <div className="flex gap-1">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-6 px-2 text-xs font-normal hover:bg-white/20 data-[state=open]:bg-white/20 focus-visible:ring-0">File</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[110] bg-popover text-popover-foreground border-border shadow-md rounded-md w-48 font-sans">
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => toast.info('New File not implemented yet')}>New</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => toast.info('Open File not implemented yet')}>Open...</DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#aaa]" />
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={handleSave}>Save <DropdownMenuShortcut className="text-current opacity-70">Ctrl+S</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => toast.info('Save As not implemented yet')}>Save As...</DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#aaa]" />
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={handleClose}>Close <DropdownMenuShortcut className="text-current opacity-70">Esc</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-6 px-2 text-xs font-normal hover:bg-white/20 data-[state=open]:bg-white/20 focus-visible:ring-0">Edit</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[110] bg-popover text-popover-foreground border-border shadow-md rounded-md w-48 font-sans">
                  <DropdownMenuItem className={cn("text-xs focus:bg-primary focus:text-white rounded-sm cursor-default", historyIdx <= 0 && "opacity-50")} onSelect={handleUndo}>Undo <DropdownMenuShortcut className="text-current opacity-70">Ctrl+Z</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuItem className={cn("text-xs focus:bg-primary focus:text-white rounded-sm cursor-default", historyIdx >= history.length - 1 && "opacity-50")} onSelect={handleRedo}>Redo <DropdownMenuShortcut className="text-current opacity-70">Ctrl+Y</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#aaa]" />
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" disabled={!selectionRange && !selectedSegmentId} onSelect={() => { if(selectionRange) handleRangeDelete(); else { setSegments(prev => { const newSegs = prev.filter(s => s.id !== selectedSegmentId); saveHistory(newSegs); setSelectedSegmentId(null); return newSegs; }); }}}>Delete <DropdownMenuShortcut className="text-current opacity-70">Del</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => handleRangeSplit()} disabled={!selectionRange}>Split</DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#aaa]" />
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setActiveTool('select')}>Select Tool <DropdownMenuShortcut className="text-current opacity-70">1</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setActiveTool('move')}>Event Tool <DropdownMenuShortcut className="text-current opacity-70">2</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setActiveTool('range')}>Range Tool <DropdownMenuShortcut className="text-current opacity-70">4</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-6 px-2 text-xs font-normal hover:bg-white/20 data-[state=open]:bg-white/20 focus-visible:ring-0">View</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[110] bg-popover text-popover-foreground border-border shadow-md rounded-md w-48 font-sans">
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setZoom(z => Math.min(1000, z * 1.5))}>Zoom In</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setZoom(z => Math.max(0.5, z / 1.5))}>Zoom Out</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setZoom(1)}>Zoom Normal</DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#aaa]" />
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setSnapToGrid(!snapToGrid)}>
                    {snapToGrid ? "✓ " : ""}Snap to Grid
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-6 px-2 text-xs font-normal hover:bg-white/20 data-[state=open]:bg-white/20 focus-visible:ring-0">Process</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[110] bg-popover text-popover-foreground border-border shadow-md rounded-md w-48 font-sans">
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => toast.info('Process Mute not implemented yet')}>Mute</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => toast.info('Process Reverse not implemented yet')}>Reverse</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => toast.info('Process Normalize not implemented yet')}>Normalize</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => toast.info('Process Fade In not implemented yet')}>Fade In</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => toast.info('Process Fade Out not implemented yet')}>Fade Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-6 px-2 text-xs font-normal hover:bg-white/20 data-[state=open]:bg-white/20 focus-visible:ring-0">Effects</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[110] bg-popover text-popover-foreground border-border shadow-md rounded-md w-48 font-sans max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="px-2 py-1.5 border-b border-border mb-1 sticky top-0 bg-popover z-10">
                    <div className="relative">
                      <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input 
                        type="text" 
                        placeholder="Search effects..." 
                        value={effectSearch}
                        onChange={(e) => setEffectSearch(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded-sm py-1 pl-6 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                        onKeyDown={(e) => e.stopPropagation()} 
                      />
                    </div>
                  </div>
                  {EFFECTS.filter(eff => eff.name.toLowerCase().includes(effectSearch.toLowerCase()) || eff.id.toLowerCase().includes(effectSearch.toLowerCase())).map(eff => (
                    <DropdownMenuItem key={eff.id} className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => addEffect(eff)}>
                      {eff.name}...
                    </DropdownMenuItem>
                  ))}
                  {EFFECTS.filter(eff => eff.name.toLowerCase().includes(effectSearch.toLowerCase()) || eff.id.toLowerCase().includes(effectSearch.toLowerCase())).length === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground text-center">No effects found</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-6 px-2 text-xs font-normal hover:bg-white/20 data-[state=open]:bg-white/20 focus-visible:ring-0">Tools</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[110] bg-popover text-popover-foreground border-border shadow-md rounded-md w-48 font-sans">
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setActiveEnvelope(activeEnvelope === 'volume' ? null : 'volume')}>
                    {activeEnvelope === 'volume' ? "✓ " : ""}Volume Envelope
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setActiveEnvelope(activeEnvelope === 'pan' ? null : 'pan')}>
                    {activeEnvelope === 'pan' ? "✓ " : ""}Pan Envelope
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-6 px-2 text-xs font-normal hover:bg-white/20 data-[state=open]:bg-white/20 focus-visible:ring-0">Options</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[110] bg-popover text-popover-foreground border-border shadow-md rounded-md w-48 font-sans">
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setShowPreferencesDialog(true)}>Preferences...</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-6 px-2 text-xs font-normal hover:bg-white/20 data-[state=open]:bg-white/20 focus-visible:ring-0">Help</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[110] bg-popover text-popover-foreground border-border shadow-md rounded-md w-48 font-sans">
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => setShowHelpDialog(true)}>Help & Support</DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#aaa]" />
                  <DropdownMenuItem className="text-xs focus:bg-primary focus:text-white rounded-sm cursor-default" onSelect={() => toast.info('Wave Editor v2.0 - Studio Engine')}>About Wave Editor</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Standard Toolbar */}
          {isMobile ? (
            <div className="flex items-center justify-between px-4 py-2 bg-card/40 border-b border-border/40 shrink-0 shadow-md">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-8 rounded-lg">
                    <Settings2 className="w-4 h-4" /> Editor Tools
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[75vh] bg-card border-border overflow-y-auto custom-scrollbar p-6">
                  <SheetHeader className="mb-4 text-left">
                    <SheetTitle>Editor Tools</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase">File Actions</span>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="flex-1 gap-2"><FileText className="w-4 h-4" /> New</Button>
                        <Button variant="secondary" size="sm" className="flex-1 gap-2"><FolderOpen className="w-4 h-4" /> Open</Button>
                        <Button variant="secondary" size="sm" onClick={handleSave} className="flex-1 gap-2 text-primary"><Save className="w-4 h-4" /> Save</Button>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase">History</span>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={handleUndo} disabled={historyIdx <= 0} className="flex-1 gap-2"><Undo2 className="w-4 h-4" /> Undo</Button>
                        <Button variant="secondary" size="sm" onClick={handleRedo} disabled={historyIdx >= history.length - 1} className="flex-1 gap-2"><Redo2 className="w-4 h-4" /> Redo</Button>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Cursor Tools</span>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant={activeTool === 'select' ? "default" : "secondary"} size="sm" onClick={() => setActiveTool('select')} className="gap-2"><MousePointer2 className="w-4 h-4" /> Select</Button>
                        <Button variant={activeTool === 'range' ? "default" : "secondary"} size="sm" onClick={() => setActiveTool('range')} className="gap-2"><SquareDashedBottom className="w-4 h-4" /> Range</Button>
                        <Button variant={activeTool === 'move' ? "default" : "secondary"} size="sm" onClick={() => setActiveTool('move')} className="gap-2"><MoveHorizontal className="w-4 h-4" /> Move</Button>
                        <Button variant={snapToGrid ? "default" : "secondary"} size="sm" onClick={() => setSnapToGrid(!snapToGrid)} className="gap-2"><Magnet className="w-4 h-4" /> Snap</Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Envelopes</span>
                      <div className="flex gap-2">
                        <Button variant={activeEnvelope === 'volume' ? "default" : "secondary"} size="sm" onClick={() => setActiveEnvelope(activeEnvelope === 'volume' ? null : 'volume')} className="flex-1">Vol Env</Button>
                        <Button variant={activeEnvelope === 'pan' ? "default" : "secondary"} size="sm" onClick={() => setActiveEnvelope(activeEnvelope === 'pan' ? null : 'pan')} className="flex-1">Pan Env</Button>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 rounded-lg text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20">
                <X className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>
          ) : (
            <div className="flex items-center px-4 py-2 bg-card/40 border-b border-border/40 gap-2 shrink-0 shadow-md">
              <TooltipProvider delayDuration={200}>
                <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg border border-transparent shadow-none">
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md">
                      <FileText className="w-4 h-4" /> <span className="text-xs">New</span>
                    </Button>
                  </TooltipTrigger><TooltipContent side="bottom" className="text-xs">New File</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md">
                      <FolderOpen className="w-4 h-4" /> <span className="text-xs">Open</span>
                    </Button>
                  </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Open File</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleSave} className="h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md">
                      <Save className="w-4 h-4" /> <span className="text-xs">Save</span>
                    </Button>
                  </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Save Edits</TooltipContent></Tooltip>
                </div>

                <div className="w-px h-5 bg-border/50 mx-1 border-none" />

                <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg border border-transparent shadow-none">
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleUndo} className={cn("h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md", historyIdx <= 0 && "opacity-50")}>
                      <Undo2 className="w-4 h-4" /> <span className="text-xs">Undo</span>
                    </Button>
                  </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Undo</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleRedo} className={cn("h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md", historyIdx >= history.length - 1 && "opacity-50")}>
                      <Redo2 className="w-4 h-4" /> <span className="text-xs">Redo</span>
                    </Button>
                  </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Redo</TooltipContent></Tooltip>
                </div>

                <div className="w-px h-5 bg-border/50 mx-1 border-none" />

                <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg border border-transparent shadow-none">
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTool('select')} className={cn("h-7 px-2 gap-1.5 rounded-md", activeTool === 'select' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground")}>
                      <MousePointer2 className="w-4 h-4" /> <span className="text-xs">Select</span>
                    </Button>
                  </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Edit Tool</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTool('range')} className={cn("h-7 px-2 gap-1.5 rounded-md", activeTool === 'range' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground")}>
                      <SquareDashedBottom className="w-4 h-4" /> <span className="text-xs">Range</span>
                    </Button>
                  </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Time Zoom/Selection Tool</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTool('move')} className={cn("h-7 px-2 gap-1.5 rounded-md", activeTool === 'move' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground")}>
                      <MoveHorizontal className="w-4 h-4" /> <span className="text-xs">Move</span>
                    </Button>
                  </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Event Tool</TooltipContent></Tooltip>
                </div>

                <div className="w-px h-5 bg-border/50 mx-1 border-none" />

                <Tooltip><TooltipTrigger asChild>
                  <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSnapToGrid(!snapToGrid)} 
                      className={cn("h-7 px-2 text-xs", snapToGrid ? "bg-primary/20 text-primary rounded-md" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md")}
                    >
                      <Magnet className="w-3.5 h-3.5 mr-1" />
                      Snap
                  </Button>
                </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Snap to Events/Grid</TooltipContent></Tooltip>
              </TooltipProvider>
              
              <div className="w-px h-5 bg-border/50 mx-1 border-none" />

              <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg border border-transparent shadow-none">
                <Button variant="ghost" size="sm" onClick={() => setActiveEnvelope(activeEnvelope === 'volume' ? null : 'volume')} className={cn("h-7 px-2 text-xs rounded-md", activeEnvelope === 'volume' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80")}>Vol Env</Button>
                <Button variant="ghost" size="sm" onClick={() => setActiveEnvelope(activeEnvelope === 'pan' ? null : 'pan')} className={cn("h-7 px-2 text-xs rounded-md", activeEnvelope === 'pan' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80")}>Pan Env</Button>
              </div>

              <div className="flex-1" />

              <div className="flex flex-col bg-secondary/30 px-3 py-1 rounded-lg shadow-inner border border-border/50">
                <span className="text-[8px] text-muted-foreground font-sans font-bold leading-none mb-1 uppercase">Selection</span>
                <div className="flex gap-3 items-end">
                  <div className="flex flex-col">
                    <span className="text-[7px] text-muted-foreground/70 leading-none mb-0.5">Start</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max={track?.duration || 40}
                      value={selectionRange ? selectionRange.start.toFixed(3) : "0.000"}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        if (selectionRange) {
                          setSelectionRange({ start: v, end: Math.max(v, selectionRange.end) });
                        } else {
                          setSelectionRange({ start: v, end: v });
                        }
                      }}
                      className="text-[10px] text-foreground font-mono leading-none w-16 bg-background/50 border border-border/50 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] text-muted-foreground/70 leading-none mb-0.5">End</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max={track?.duration || 40}
                      value={selectionRange ? selectionRange.end.toFixed(3) : "0.000"}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        if (selectionRange) {
                          setSelectionRange({ start: Math.min(v, selectionRange.start), end: v });
                        } else {
                          setSelectionRange({ start: v, end: v });
                        }
                      }}
                      className="text-[10px] text-foreground font-mono leading-none w-16 bg-background/50 border border-border/50 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] text-muted-foreground/70 leading-none mb-0.5">Length</span>
                    <span className="text-[10px] text-primary font-mono leading-none font-bold">
                      {selectionRange ? Math.abs(selectionRange.end - selectionRange.start).toFixed(3) : "0.000"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Time Display */}
              <div className="bg-[#0a0a0c] border border-border/50 px-4 py-1.5 rounded-lg shadow-inner flex flex-col justify-center min-w-[140px]">
                <span className="text-[10px] text-primary/70 font-mono leading-none mb-0.5">POSITION</span>
                <span className="text-primary font-mono text-xl leading-none tracking-widest font-bold">
                  {String(Math.floor(playhead / 60)).padStart(2, '0')}:
                  {String(Math.floor(playhead % 60)).padStart(2, '0')}.
                  {String(Math.floor((playhead % 1) * 10000)).padStart(4, '0')}
                </span>
              </div>

              <Button variant="ghost" size="sm" onClick={handleClose} className="ml-2 h-8 rounded-lg text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20">
                <X className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>
          )}

          {/* Main Editor Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0c]">
            
            {/* Playback Controls */}
            <div className="h-12 bg-card/40 border-b border-border/40 flex items-center px-4 gap-4 shadow-sm shrink-0 justify-between">
              <TooltipProvider delayDuration={200}>
                <div className="flex gap-1 bg-secondary/30 p-1.5 rounded-xl border border-border/50 shadow-inner items-center">
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg" onClick={() => setPlayhead(0)}>
                    <SkipBack className="w-4 h-4 fill-current" />
                  </Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Return to Zero</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg" onClick={() => setPlayhead(Math.max(0, playhead - 5))}>
                    <Rewind className="w-4 h-4 fill-current" />
                  </Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Rewind</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", isPlaying ? "text-primary bg-primary/20 shadow-inner" : "text-muted-foreground hover:text-foreground hover:bg-secondary")} onClick={() => setIsPlaying(!isPlaying)}>
                    <Play className="w-4 h-4 fill-current" />
                  </Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">{isPlaying ? "Pause" : "Play"} <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Space</kbd></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg" onClick={(e) => { setIsPlaying(false); setPlayhead(0); e.currentTarget.blur(); }}>
                    <Square className="w-4 h-4" />
                  </Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Stop <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Space / Enter</kbd></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg" onClick={() => setPlayhead(Math.min(track?.duration || 40, playhead + 5))}>
                    <FastForward className="w-4 h-4 fill-current" />
                  </Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Fast Forward</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg" onClick={() => setPlayhead(track?.duration || 40)}>
                    <SkipForward className="w-4 h-4 fill-current" />
                  </Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Go to End</TooltipContent></Tooltip>
                  <div className="w-px h-6 bg-border/50 mx-1" />
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                    <Circle className="w-4 h-4 fill-current" />
                  </Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Record</TooltipContent></Tooltip>
                </div>
              </TooltipProvider>

              <div className="flex items-center gap-3 text-muted-foreground">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground hover:bg-secondary/50 rounded-lg" onClick={() => setZoom(z => Math.max(0.5, z / 1.5))}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Slider value={[zoom]} min={0.5} max={200} step={0.1} onValueChange={(v) => setZoom(v[0])} className="w-32" />
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground hover:bg-secondary/50 rounded-lg" onClick={() => setZoom(z => Math.min(1000, z * 1.5))}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Data Window (Waveform) */}
            <div 
              className="flex-1 relative bg-[#0f0f13] overflow-x-auto overflow-y-hidden custom-scrollbar focus:outline-none touch-none border-y border-border/50 m-0" 
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
                  setZoom(z => Math.max(0.5, Math.min(1000, z * zoomFactor)));
                }
              }}
            >
              {/* Timeline Ruler */}
              {(() => {
                const rulerMultiplier = zoom > 100 ? 100 : zoom > 10 ? 10 : 2;
                return (
                  <div className="absolute top-0 left-0 right-0 h-6 bg-card/40 border-b border-border/30 z-10 pointer-events-none" style={{ width: `${100 * zoom}%`, minWidth: '100%' }}>
                    {Array.from({ length: Math.ceil((track?.duration || 40) * rulerMultiplier) }).map((_, i) => {
                      const seconds = i / rulerMultiplier;
                      const formattedTime = `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
                      return (
                        <div key={i} className={cn("absolute bottom-0 border-l border-border/40", i % rulerMultiplier === 0 ? "h-full" : (rulerMultiplier >= 10 && i % (rulerMultiplier/10) === 0 ? "h-3" : "h-1.5"))} style={{ left: `${(seconds / (track?.duration || 40)) * 100}%` }}>
                          {i % rulerMultiplier === 0 && <span className="absolute top-0.5 left-1 text-[9px] text-muted-foreground/50 font-sans">{formattedTime}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              
              {/* Center Line (Zero Crossing) */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-border/50 pointer-events-none z-0" style={{ width: `${100 * zoom}%`, minWidth: '100%' }} />

              {/* Pending Start Marker (click-to-select first click) */}
              {pendingStart !== null && (
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-accent z-25 pointer-events-none shadow-[0_0_8px_rgba(var(--accent),0.8)]"
                  style={{ left: `${(pendingStart / (track?.duration || 40)) * 100 * zoom}%` }}
                >
                  <div className="absolute top-0 -translate-x-1/2 bg-accent text-accent-foreground text-[9px] font-mono px-1.5 py-0.5 rounded-b font-bold whitespace-nowrap">
                    START
                  </div>
                </div>
              )}

              {/* Range Selection Overlay */}
              {selectionRange && (
                <>
                <div
                  className="absolute top-6 bottom-0 bg-primary/20 border-l-2 border-r-2 border-primary pointer-events-none z-20"
                  style={{
                    left: `${(Math.min(selectionRange.start, selectionRange.end) / (track?.duration || 40)) * 100 * zoom}%`,
                    width: `${(Math.abs(selectionRange.end - selectionRange.start) / (track?.duration || 40)) * 100 * zoom}%`
                  }}
                >
                  {/* Length label inside the highlight */}
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-mono px-2 py-0.5 rounded font-bold shadow-lg whitespace-nowrap">
                    {Math.abs(selectionRange.end - selectionRange.start).toFixed(3)}s
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
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-white/80 hover:text-white px-2 gap-1" onClick={(e) => { e.stopPropagation(); handleRangeFade('in'); }}>
                      <Wand2 className="w-3 h-3" /> Fade In
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-white/80 hover:text-white px-2 gap-1" onClick={(e) => { e.stopPropagation(); handleRangeFade('out'); }}>
                      <Wand2 className="w-3 h-3" /> Fade Out
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-white/80 hover:text-white px-2 gap-1" onClick={(e) => { e.stopPropagation(); handleRangeMute(); }}>
                      <VolumeX className="w-3 h-3" /> Mute
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2 gap-1" onClick={(e) => { e.stopPropagation(); handleRangeDelete(); }}>
                      <Trash2 className="w-3 h-3" /> Delete
                    </Button>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/50 hover:text-white" onClick={(e) => { e.stopPropagation(); setSelectionRange(null); setPendingStart(null); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                </>
              )}

              {/* Click-to-select hint */}
              {activeTool === 'select' && !selectionRange && !pendingStart && (
                <div className="absolute top-7 left-1/2 -translate-x-1/2 z-10 bg-secondary/80 text-muted-foreground text-[10px] px-3 py-1 rounded-full border border-border/50 pointer-events-none animate-pulse">
                  Double-click on the waveform to edit — set start & end points, then Split, Fade, Mute, or Delete
                </div>
              )}
              {pendingStart !== null && (
                <div className="absolute top-7 left-1/2 -translate-x-1/2 z-10 bg-accent/20 text-accent text-[10px] px-3 py-1 rounded-full border border-accent/50 pointer-events-none font-semibold">
                  Start set at {pendingStart.toFixed(3)}s — click end point to complete selection
                </div>
              )}

              {/* Segments Container */}
              <div className="absolute top-6 bottom-0 left-0" style={{ width: `${100 * zoom}%`, minWidth: '100%' }}>
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
                      "audio-segment absolute top-0 bottom-0 border border-white/10 rounded-lg overflow-hidden flex items-center transition-all group shadow-sm bg-card/40 backdrop-blur",
                      activeTool === 'move' ? "cursor-grab active:cursor-grabbing hover:border-white/30" : "",
                      activeTool === 'split' ? "hover:border-red-500/50 cursor-crosshair" : "",
                      selectedSegmentId === seg.id ? "border-primary shadow-[inset_0_0_30px_hsl(var(--primary)/0.15)] z-10" : "z-0"
                    )}
                    style={{
                      left: `${(seg.startOffset / (track?.duration || 40)) * 100}%`,
                      width: `${(seg.duration / (track?.duration || 40)) * 100}%`
                    }}
                  >
                    {/* Header bar of segment */}
                    <div className="absolute top-0 left-0 right-0 h-5 bg-card/60 border-b border-border/30 backdrop-blur flex items-center px-2 pl-4 z-20 pointer-events-none">
                      <span className="text-[10px] text-muted-foreground font-sans truncate font-semibold">{track.name} - Event {idx+1}</span>
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
                              
                              const fullRatio = initialSeg.sourceEnd - initialSeg.sourceStart;
                              const maxLeftTime = initialSeg.startOffset - (initialSeg.sourceStart * initialSeg.duration / fullRatio);
                              
                              newStart = Math.max(maxLeftTime, Math.max(0, Math.min(newStart, initialSeg.startOffset + initialSeg.duration - 0.01)));
                              newStart = getSnappedTime(newStart);
                              newStart = Math.max(maxLeftTime, Math.max(0, Math.min(newStart, initialSeg.startOffset + initialSeg.duration - 0.01)));
                              
                              const timeDiff = newStart - initialSeg.startOffset;
                              const ratio = timeDiff / initialSeg.duration;
                              const newSourceStart = initialSeg.sourceStart + fullRatio * ratio;
                              
                              setSegments(prev => prev.map(s => {
                                  if (s.id === initialSeg.id) {
                                      return {
                                          ...s,
                                          startOffset: newStart,
                                          sourceStart: newSourceStart,
                                          duration: initialSeg.duration - timeDiff,
                                          waveform: initialSeg.waveform,
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
                              
                              const fullRatio = initialSeg.sourceEnd - initialSeg.sourceStart;
                              const maxRightTime = initialSeg.startOffset + initialSeg.duration + ((1 - initialSeg.sourceEnd) * initialSeg.duration / fullRatio);

                              newEnd = Math.min(maxRightTime, Math.max(initialSeg.startOffset + 0.01, Math.min(newEnd, track?.duration || 40)));
                              newEnd = getSnappedTime(newEnd);
                              newEnd = Math.min(maxRightTime, Math.max(initialSeg.startOffset + 0.01, Math.min(newEnd, track?.duration || 40)));
                              
                              const newDuration = newEnd - initialSeg.startOffset;
                              const ratio = newDuration / initialSeg.duration;
                              const newSourceEnd = initialSeg.sourceStart + fullRatio * ratio;
                              
                              setSegments(prev => prev.map(s => {
                                  if (s.id === initialSeg.id) {
                                      return {
                                          ...s,
                                          sourceEnd: newSourceEnd,
                                          duration: newDuration,
                                          waveform: initialSeg.waveform,
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

                    {/* Gain Line (hidden when envelope is active) */}
                    {!activeEnvelope && (
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
                    )}

                    {/* Automation Envelopes */}
                    {activeEnvelope && (
                        <div 
                            className="absolute inset-0 z-40"
                            onPointerDown={(e) => {
                                if (e.target !== e.currentTarget) return;
                                if (activeTool !== 'select') return;
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const t = (e.clientX - rect.left) / rect.width;
                                const v = 1 - ((e.clientY - rect.top) / rect.height);
                                const envKey = activeEnvelope === 'volume' ? 'volEnv' : 'panEnv';
                                const env = getEnv(seg, envKey);
                                const newEnv = [...env, {t, v}].sort((a,b) => a.t - b.t);
                                
                                setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, [envKey]: newEnv } : s));
                                setTimeout(commitSegmentChange, 0);
                            }}
                        >
                            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 100">
                                <polyline 
                                    points={getEnv(seg, activeEnvelope === 'volume' ? 'volEnv' : 'panEnv').map(p => `${p.t * 1000},${(1 - p.v) * 100}`).join(' ')}
                                    className={activeEnvelope === 'volume' ? "stroke-blue-400" : "stroke-red-400"}
                                    fill="none"
                                    strokeWidth="2"
                                    vectorEffect="non-scaling-stroke"
                                />
                            </svg>
                            {getEnv(seg, activeEnvelope === 'volume' ? 'volEnv' : 'panEnv').map((p, i, arr) => (
                                <div 
                                    key={i}
                                    className={cn(
                                        "absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white cursor-pointer pointer-events-auto shadow-sm",
                                        activeEnvelope === 'volume' ? "bg-blue-500" : "bg-red-500"
                                    )}
                                    style={{ left: `${p.t * 100}%`, top: `${(1 - p.v) * 100}%` }}
                                    title={activeEnvelope === 'volume' ? `Vol: ${Math.round(p.v * 100)}%` : `Pan: ${Math.round((p.v - 0.5) * 200)}%`}
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        if (activeTool !== 'select') return;
                                        const envKey = activeEnvelope === 'volume' ? 'volEnv' : 'panEnv';
                                        
                                        const startY = e.clientY;
                                        const startX = e.clientX;
                                        const startT = p.t;
                                        const startV = p.v;
                                        const rect = e.target.parentElement.getBoundingClientRect();
                   
                                        const handleMove = (moveEv) => {
                                            const deltaX = moveEv.clientX - startX;
                                            const deltaY = moveEv.clientY - startY;
                                            let newT = startT + deltaX / rect.width;
                                            let newV = startV - deltaY / rect.height;
                   
                                            newV = Math.max(0, Math.min(1, newV));
                                            
                                            if (i === 0) newT = 0;
                                            else if (i === arr.length - 1) newT = 1;
                                            else {
                                                const minT = arr[i-1].t + 0.001;
                                                const maxT = arr[i+1].t - 0.001;
                                                newT = Math.max(minT, Math.min(maxT, newT));
                                            }
                   
                                            setSegments(prev => prev.map(s => {
                                                if (s.id === seg.id) {
                                                    const updatedEnv = [...getEnv(s, envKey)];
                                                    updatedEnv[i] = { t: newT, v: newV };
                                                    return { ...s, [envKey]: updatedEnv };
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
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (i === 0 || i === arr.length - 1) return;
                                        const envKey = activeEnvelope === 'volume' ? 'volEnv' : 'panEnv';
                                        setSegments(prev => prev.map(s => {
                                            if (s.id === seg.id) {
                                                const updatedEnv = getEnv(s, envKey).filter((_, idx) => idx !== i);
                                                return { ...s, [envKey]: updatedEnv };
                                            }
                                            return s;
                                        }));
                                        commitSegmentChange();
                                    }}
                                />
                            ))}
                        </div>
                    )}

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

                    {/* Waveform - Pro grade rendering (peak fill + RMS body + outline) */}
                    {(() => {
                      const wf = seg.waveform || [];
                      const wLen = wf.length - 1 || 1;
                      const g = seg.gain ?? 1;
                      const gradId = `wf-grad-${seg.id}`;
                      const rmsId = `wf-rms-${seg.id}`;
                      const glowId = `wf-glow-${seg.id}`;

                      // Peak closed path
                      let peakPath = `M 0,50 `;
                      for (let i = 0; i <= wLen; i++) peakPath += `L ${(i/wLen)*10000},${50 - Math.max(0.001, wf[i])*48*g} `;
                      for (let i = wLen; i >= 0; i--) peakPath += `L ${(i/wLen)*10000},${50 + Math.max(0.001, wf[i])*48*g} `;
                      peakPath += 'Z';

                      const baseFill = "text-[#1ED760] fill-[#1ED760]";

                      const srcStart = seg.sourceStart || 0;
                      const srcEnd = seg.sourceEnd ?? 1;
                      const ratio = srcEnd - srcStart || 1;

                      return (
                        <div className="absolute inset-y-0 pointer-events-none" style={{
                           left: `-${(srcStart / ratio) * 100}%`,
                           width: `${(1 / ratio) * 100}%`
                        }}>
                          <svg className="w-full h-full pt-5 pb-0 pointer-events-none" style={{ filter: 'drop-shadow(0px 0px 5px rgba(30,215,96,0.4))' }} preserveAspectRatio="none" viewBox="0 0 10000 100">
                            <defs>
                              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
                                <stop offset="35%" stopColor="currentColor" stopOpacity="0.75" />
                                <stop offset="50%" stopColor="currentColor" stopOpacity="0.3" />
                                <stop offset="65%" stopColor="currentColor" stopOpacity="0.75" />
                                <stop offset="100%" stopColor="currentColor" stopOpacity="0.95" />
                              </linearGradient>
                            </defs>
                            <g className={baseFill}>
                              <path 
                                d={peakPath} 
                                fill={`url(#${gradId})`} 
                                shapeRendering="geometricPrecision"
                              />
                            </g>
                            <line x1="0" y1="50" x2="10000" y2="50" stroke="#000000" strokeOpacity="0.5" strokeWidth="2" vectorEffect="non-scaling-stroke" shapeRendering="geometricPrecision" />
                          </svg>
                        </div>
                      );
                    })()}
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
                <div className="px-2 py-2 border-b border-white/5 bg-[#1c1c1e]/50">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input 
                      type="text" 
                      placeholder="Search effects..." 
                      value={effectSearch}
                      onChange={(e) => setEffectSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-md py-1.5 pl-8 pr-3 text-xs text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {EFFECTS.filter(eff => eff.name.toLowerCase().includes(effectSearch.toLowerCase()) || eff.id.toLowerCase().includes(effectSearch.toLowerCase())).map(eff => (
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
              <div ref={effectsContainerRef} className="flex-1 flex overflow-x-auto custom-scrollbar p-3 gap-3 bg-[#252528] items-stretch shadow-[inset_0_4px_20px_rgba(0,0,0,0.2)]">
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
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => toggleCollapseEffect(eff.id)} 
                              className="text-white/40 hover:text-white transition-colors p-1 hover:bg-white/5 rounded"
                              title="Toggle Visibility"
                            >
                              <ChevronDown className={cn("w-3 h-3 transition-transform", collapsedEffects[eff.id] && "-rotate-90")} />
                            </button>
                            <button onClick={() => removeEffect(eff.id)} className="text-white/40 hover:text-red-400 transition-colors p-1 hover:bg-white/5 rounded" title="Remove Effect">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {!collapsedEffects[eff.id] && (
                          <div className="p-4 flex flex-wrap gap-4 h-full items-start justify-center overflow-y-auto custom-scrollbar">
                            {eff.params.map(p => (
                              <Knob 
                                key={p.name}
                                label={p.name}
                                min={p.min}
                                max={p.max}
                                value={eff.paramValues[p.name] !== undefined ? eff.paramValues[p.name] : (p.min + p.max) / 2}
                                onChange={(v) => updateEffectParam(eff.id, p.name, v)}
                                formatValue={(v) => {
                                  const n = p.name.toLowerCase();
                                  if (n.includes('freq') || n.includes('hz') || ((n === 'low' || n === 'mid' || n === 'high' || n === 'crossover') && p.max > 1000)) {
                                    return v >= 1000 ? `${(v/1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`;
                                  }
                                  if (n.includes('time') || n.includes('attack') || n.includes('release') || n.includes('delay') || (n === 'decay' && p.max > 10)) {
                                    return `${Math.round(v)} ms`;
                                  }
                                  if (n === 'decay' && p.max <= 10) {
                                    return `${v.toFixed(1)} s`;
                                  }
                                  if (n.includes('ratio')) {
                                    return `${Math.round(v)}:1`;
                                  }
                                  if (n.includes('thresh') || n.includes('gain') || n.includes('makeup') || n.includes('output') || n.includes('input') || n.includes('ceiling') || n === 'low' || n === 'mid' || n === 'high' || n === 'lf' || n === 'lmf' || n === 'hmf' || n === 'hf') {
                                    return `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
                                  }
                                  if (n.includes('mix') || n.includes('depth') || n.includes('feedback') || n.includes('amount') || n.includes('drive')) {
                                    return `${Math.round(v)}%`;
                                  }
                                  return `${Math.round(v)}`;
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>

          </div>
        </motion.div>

        {/* Help Dialog */}
        <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
          <DialogContent className="max-w-md bg-card border-border text-foreground z-[200]">
            <DialogHeader>
              <DialogTitle>Wave Editor Help & Support</DialogTitle>
              <DialogDescription>
                Quick guide on how to use the advanced wave editor tools.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Keyboard Shortcuts</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Play / Pause</span><span className="font-mono bg-background px-1 rounded border border-border">Space</span></div>
                  <div className="flex justify-between bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Undo</span><span className="font-mono bg-background px-1 rounded border border-border">Ctrl+Z</span></div>
                  <div className="flex justify-between bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Redo</span><span className="font-mono bg-background px-1 rounded border border-border">Ctrl+Y</span></div>
                  <div className="flex justify-between bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Split</span><span className="font-mono bg-background px-1 rounded border border-border">S</span></div>
                  <div className="flex justify-between bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Delete</span><span className="font-mono bg-background px-1 rounded border border-border">Del</span></div>
                  <div className="flex justify-between bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Save & Close</span><span className="font-mono bg-background px-1 rounded border border-border">Ctrl+S</span></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Tools Guide</h4>
                <ul className="text-xs space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Edit Tool (1):</strong> Drag edges to trim clips. Adjust the gain line to change clip volume.</li>
                  <li><strong className="text-foreground">Range Tool (4):</strong> Click and drag to select a specific time range to delete or split.</li>
                  <li><strong className="text-foreground">Event Tool (2):</strong> Drag entire clips left and right to move them in time.</li>
                  <li><strong className="text-foreground">Snap (Magnet):</strong> Toggles snapping to grid. Helpful for precise micro-edits.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Automation</h4>
                <p className="text-xs text-muted-foreground">
                  Click on "Vol Env" or "Pan Env" in the toolbar to show automation curves. Click on the line to add points, and drag them to automate volume and panning over time. Double click a point to remove it.
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={() => setShowHelpDialog(false)}>Got it</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preferences Dialog */}
        <Dialog open={showPreferencesDialog} onOpenChange={setShowPreferencesDialog}>
          <DialogContent className="max-w-md bg-card border-border text-foreground z-[200]">
            <DialogHeader>
              <DialogTitle>Audio Preferences</DialogTitle>
              <DialogDescription>
                Configure your audio hardware and editing settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">Audio Input Device</span>
                <span className="text-muted-foreground text-xs">System Default</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Audio Output Device</span>
                <span className="text-muted-foreground text-xs">System Default</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Sample Rate</span>
                <span className="text-muted-foreground text-xs">44.1 kHz</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Buffer Size</span>
                <span className="text-muted-foreground text-xs">256 samples</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Hardware Acceleration</span>
                <span className="text-green-500 text-xs font-semibold">Enabled</span>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={() => setShowPreferencesDialog(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>

      </motion.div>
    </AnimatePresence>
  );
}