import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Square, Circle, Mic, Plus, Settings2, Volume2, Scissors, Copy, Save, Download, FastForward, Rewind, MoreVertical, Maximize2, Pause, Layers, Headphones, Speaker, Keyboard, Upload, Cpu, Activity, Trash2, MousePointer2, MoveHorizontal, Grid, Shuffle, Crosshair, PenTool, Link2, Unlock, TrendingUp, Option, Undo, Redo, SlidersHorizontal, Wand2, Image as ImageIcon, Users, Video, VideoOff, Radio, Loader2, GripVertical, Check, Edit2, ChevronRight, ChevronLeft, Repeat, RefreshCw, ListTodo, AudioLines, Home, Compass, MessageSquare, User } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import BounceDialog from '@/components/studio/BounceDialog';
import { sounds } from '@/hooks/use-sound';
import { useSubscription } from '@/hooks/useSubscription';


import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { separateStems, generateMelody, renderMixToWav, renderMixToMp3 } from '@/lib/audioProcessing';
import { useStudioPresence } from '@/hooks/useStudioPresence';
import LivePresenceBar from '@/components/studio/LivePresenceBar';
import HardwarePreferencesDialog from '@/components/studio/HardwarePreferencesDialog';
import MixerPanel from '@/components/studio/MixerPanel';
import KeyboardShortcutsDialog from '@/components/studio/KeyboardShortcutsDialog';
import TrackWaveformSVG from '@/components/studio/TrackWaveformSVG';
import StudioExtras from '@/components/studio/StudioExtras';
import StudioWelcome from '@/components/studio/StudioWelcome';
import StudioDialogs from '@/components/studio/StudioDialogs';
import JamRoomOverlay from '@/components/studio/JamRoomOverlay';
import StudioToolbar2 from '@/components/studio/StudioToolbar2';
import ExportPurchaseDialog from '@/components/studio/ExportPurchaseDialog';

const generateWaveform = (len = 8000) => Array.from({ length: len }, (_, i) => Math.min(1, Math.max(0.001, Math.abs((Math.sin(i * 0.1) * Math.cos(i * 0.05)) * (Math.random() * 0.8 + 0.1) * (Math.sin(i * Math.PI / len) * 0.8 + 0.2)) * 2)));

export default function Studio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const currentTimeRef = useRef(0);
  const timeDisplayRef = useRef(null);
  const recordingIndicatorRefs = useRef({});
  const recordingCanvasRefs = useRef({});
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const liveWaveformRef = useRef([]);
  const recordingStartRealRef = useRef(null); // performance.now() at recording start for accurate sync
  const [zoom, setZoom] = useState(1);
  const playheadRef = useRef(null);
  const headerPlayheadRef = useRef(null);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  // Millisecond-precision time for surgical editing tooltips
  const formatTimePrecise = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Floating tooltip for precision editing — DOM-direct to avoid re-renders during drag
  const editTooltipRef = useRef(null);
  const showEditTooltip = (x, y, time) => {
    const el = editTooltipRef.current;
    if (!el) return;
    el.style.opacity = '1';
    el.style.left = `${x + 12}px`;
    el.style.top = `${y - 34}px`;
    el.textContent = formatTimePrecise(time);
  };
  const hideEditTooltip = () => {
    if (editTooltipRef.current) editTooltipRef.current.style.opacity = '0';
  };
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioElementsRef = useRef({});
  const fileInputRef = useRef(null);
  const [renamingTrack, setRenamingTrack] = useState(null);
  const [newTrackName, setNewTrackName] = useState("");
  const [creatingTrack, setCreatingTrack] = useState(false);
  const [newTrackType, setNewTrackType] = useState('audio');
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);

  const [maxTracks, setMaxTracks] = useState(2); // Free tier default
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  
  const [editMode, setEditMode] = useState('slip'); // slip, grid, shuffle
  const [activeTool, setActiveTool] = useState('grab'); // smart, trim, grab, fade
  const [gridSize, setGridSize] = useState(1);

  const [masterVolume, setMasterVolume] = useState(100);
  const [showMixerPanel, setShowMixerPanel] = useState(false);
  const [loopActive, setLoopActive] = useState(false);

  // Session musical settings shown in the transport (BPM, time signature, key)
  const [bpm, setBpm] = useState(120);
  const [bpmInput, setBpmInput] = useState('120');
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [songKey, setSongKey] = useState('C Maj');
  const [audioSettings, setAudioSettings] = useState({ sampleRate: "44.1 kHz", bitDepth: "24-bit", bufferSize: "256" });
  
  const [bounceOpen, setBounceOpen] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project"); const [pendingTimeSignature, setPendingTimeSignature] = useState(null); const [pendingSongKey, setPendingSongKey] = useState(null);
  const [bounceRedirect, setBounceRedirect] = useState(null);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [showQuickMemo, setShowQuickMemo] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const [hardware, setHardware] = useState({
    mic: false,
    interface: false,
    output: false,
    midi: false
  });
  const [jamRoomActive, setJamRoomActive] = useState(false);
  const [jamVideoActive, setJamVideoActive] = useState(false);
  const [defaultRole, setDefaultRole] = useState("editor");
  const [isProcessing, setIsProcessing] = useState(null); // 'separate' | 'generate' | null

  const { isPro } = useSubscription();

  // Real-time collaborator presence
  const { peers: livePeers, setActivity } = useStudioPresence('studio-main');
  
  const [tracks, setTracks] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [hasAutosave, setHasAutosave] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nalistudio_project_autosave');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) setHasAutosave(true);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (roomId) {
      base44.entities.Project.get(roomId).then(project => {
        if (project) {
          setProjectName(project.title);
          if (project.bpm) setBpm(project.bpm);
          if (project.key) setSongKey(project.key);
          setShowWelcome(false);
          setJamRoomActive(true);
        }
      }).catch(err => console.error("Failed to load project:", err));
    }
  }, [roomId]);

  const handleStartBlank = () => { setTracks([]); setShowWelcome(false); };

  const handleLoadAutosave = () => {
    try {
      const saved = localStorage.getItem('nalistudio_project_autosave');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) { setTracks(parsed); setShowWelcome(false); return; }
      }
    } catch (e) {}
    toast.error("No autosave found");
  };

  // Demo audio is generated locally so it always plays (the old hosted sample 404'd)
  const handleLoadDemo = async () => {
    const toastId = toast.loading("Preparing demo session...");
    try {
      const [lead, beat] = await Promise.all([
        generateMelody({ seconds: 20, bpm: 90 }),
        generateMelody({ seconds: 20, bpm: 120 })
      ]);
      const base = { volume: 75, pan: 50, muted: false, solo: false, armed: false, startTime: 0, locked: false, grouped: false, showAutomation: false, elasticAudio: false, fadeIn: 0, fadeOut: 0 };
      setTracks([
        { ...base, id: 1, name: "Demo Lead", color: "bg-purple-500", waveform: lead.waveform, duration: lead.duration, audioUrl: lead.url },
        { ...base, id: 2, name: "Demo Bassline", color: "bg-blue-500", waveform: beat.waveform, duration: beat.duration, audioUrl: beat.url },
      ]);
      setShowWelcome(false);
      toast.success("Demo session ready", { id: toastId });
    } catch (e) {
      console.error("Demo session failed", e);
      toast.error("Couldn't build the demo session", { id: toastId });
    }
  };

  // Autosave tracks (Debounced to prevent lag during rapid edits)
  useEffect(() => {
    if (tracks && tracks.length > 0) {
      const timeoutId = setTimeout(() => {
        try {
          localStorage.setItem('nalistudio_project_autosave', JSON.stringify(tracks));
        } catch (e) {
          console.error("Failed to autosave project", e);
        }
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [tracks]);

  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const tracksRef = useRef(tracks);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    if (!showWelcome && historyRef.current.length === 0) {
      historyRef.current = [tracks];
      historyIndexRef.current = 0;
      setHistoryIndex(0);
    }
  }, [showWelcome, tracks]);

  const pushToHistory = (newTracks) => {
    let newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(newTracks);
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setHistoryIndex(historyIndexRef.current);
  };

  const undo = () => { if (historyIndexRef.current > 0) { historyIndexRef.current -= 1; setHistoryIndex(historyIndexRef.current); setTracks(historyRef.current[historyIndexRef.current]); } };
  const redo = () => { if (historyIndexRef.current < historyRef.current.length - 1) { historyIndexRef.current += 1; setHistoryIndex(historyIndexRef.current); setTracks(historyRef.current[historyIndexRef.current]); } };

  const setTracksWithHistory = (updater) => {
    setTracks(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setTimeout(() => pushToHistory(next), 0);
      return next;
    });
  };

  const toggleTrackProperty = (id, prop) => {
    setTracksWithHistory(prev => prev.map(t => t.id === id ? { ...t, [prop]: !t[prop] } : t));
  };

  const handleReorderTracks = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    sounds.click();
    setTracksWithHistory(prev => {
      const next = Array.from(prev);
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, moved);
      return next;
    });
  };

  // Pro & admin users get unlimited tracks. Free trial users keep the default limit.
  useEffect(() => {
    setMaxTracks(isPro ? 999 : 2);
  }, [isPro]);

  // Smooth playback via RAF - Optimized to bypass React render cycle for award-winning performance
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();
    
    const updateTime = (time) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      
      let newTime = currentTimeRef.current + delta;
      if (newTime > 100) newTime = 0; // Loop at 100s
      
      currentTimeRef.current = newTime;
      
      // Update DOM directly for maximum 60fps performance without React reconciliation
      if (timeDisplayRef.current) timeDisplayRef.current.textContent = formatTime(newTime);
      if (playheadRef.current) playheadRef.current.style.left = `${newTime * 20 * zoom}px`;
      if (headerPlayheadRef.current) headerPlayheadRef.current.style.left = `${newTime * 20 * zoom}px`;
      
      if (isRecording && recordingStartTime !== null) {
        // Use real elapsed time (performance.now) for accurate sync with the actual audio recording
        const realElapsed = recordingStartRealRef.current ? (performance.now() - recordingStartRealRef.current) / 1000 : (newTime - recordingStartTime);
        const currentWidth = Math.max(0, realElapsed) * 20 * zoom;
        Object.values(recordingIndicatorRefs.current).forEach(el => {
          if (el) el.style.width = `${currentWidth}px`;
        });
        
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
          let sum = 0;
          for(let i=0; i<dataArrayRef.current.length; i++) {
             const val = (dataArrayRef.current[i] - 128) / 128;
             sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArrayRef.current.length);
          liveWaveformRef.current.push(rms * 4); // Scale up for visibility
          
          Object.values(recordingCanvasRefs.current).forEach(canvas => {
            if (canvas && currentWidth > 0) {
               const ctx = canvas.getContext('2d');
               const height = canvas.height;
               
               // Draw only the latest sample at its time-based x position — O(1) per frame, no canvas clearing
               const points = liveWaveformRef.current;
               const idx = points.length - 1;
               // Match canvas internal resolution to recording pixel width for crisp 1:1 rendering
               const targetW = Math.max(1, Math.ceil(currentWidth));
               if (canvas.width !== targetW) canvas.width = targetW;
               ctx.clearRect(0, 0, canvas.width, height);

               const pts = liveWaveformRef.current;
               if (pts.length < 2) return;

               const centerY = height / 2;
               const maxAmp = height * 0.42;
               // Map each collected RMS sample across the full recording width
               const pixelsPerPoint = canvas.width / pts.length;

               ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
               ctx.lineWidth = 1;
               ctx.beginPath();
               for (let i = 0; i < pts.length; i++) {
                 const px = i * pixelsPerPoint;
                 const amp = Math.min(1, Math.max(0.002, pts[i])) * maxAmp;
                 ctx.moveTo(px, centerY - amp);
                 ctx.lineTo(px, centerY + amp);
               }
               ctx.stroke();

               // Center reference line for zero-crossing precision
               ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
               ctx.lineWidth = 1;
               ctx.beginPath();
               ctx.moveTo(0, centerY);
               ctx.lineTo(canvas.width, centerY);
               ctx.stroke();
            }
          });
        }
      }

      animationFrameId = requestAnimationFrame(updateTime);
    };

    if (isPlaying || isRecording) {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(updateTime);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isRecording, zoom, recordingStartTime]);

  const updateCurrentTime = (newTime) => {
    currentTimeRef.current = newTime;
    if (timeDisplayRef.current) timeDisplayRef.current.textContent = formatTime(newTime);
    if (playheadRef.current) playheadRef.current.style.left = `${newTime * 20 * zoom}px`;
    if (headerPlayheadRef.current) headerPlayheadRef.current.style.left = `${newTime * 20 * zoom}px`;
    Object.values(audioElementsRef.current).forEach(audio => { audio.currentTime = newTime; });
  };

  const togglePlay = () => {
    if (isRecording) {
      setIsRecording(false);
      stopRecordingProcess();
    }
    
    if (!isPlaying) {
      sounds.nav();
      setActivity("Playing the mix ▶️");
      tracks.forEach(track => {
        if (track.audioUrl && (!track.muted || track.solo)) {
          let audio = audioElementsRef.current[track.id];
          if (!audio || audio.src !== track.audioUrl) {
            audio = new Audio(track.audioUrl);
            audioElementsRef.current[track.id] = audio;
          }
          
          // Calculate if playhead is within track bounds
          const trackStart = track.startTime || 0;
          const trackEnd = trackStart + (track.duration || 40);
          const clipStartOffset = track.clipStart || 0;
          
          if (currentTimeRef.current >= trackStart && currentTimeRef.current < trackEnd) {
            audio.currentTime = clipStartOffset + (currentTimeRef.current - trackStart);
            audio.volume = track.muted ? 0 : ((track.volume / 100) * (masterVolume / 100));
            audio.play().catch(e => console.error("Audio playback error:", e));
          } else {
            audio.pause();
          }
        }
      });
    } else {
      sounds.click();
      Object.values(audioElementsRef.current).forEach(audio => {
        audio.pause();
      });
    }
    
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      Object.values(audioElementsRef.current).forEach(audio => {
        audio.pause();
      });
    };
  }, []);

  // Sync audio volumes
  useEffect(() => {
    tracks.forEach(track => {
      const audio = audioElementsRef.current[track.id];
      if (audio) {
        audio.volume = track.muted ? 0 : ((track.volume / 100) * (masterVolume / 100));
      }
    });
  }, [tracks, masterVolume]);

  // Hardware Detection - Refined and Optimized
  useEffect(() => {
    let mounted = true;
    let midiAccessRef = null;

    const checkDevices = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        let hasMic = false;
        let hasInterface = false;
        let hasOutput = false;

        for (const device of devices) {
          if (device.kind === 'audioinput') {
            hasMic = true;
            const label = device.label.toLowerCase();
            if (label && (label.includes('usb') || label.includes('interface') || label.includes('focusrite') || label.includes('steinberg') || label.includes('behringer') || label.includes('universal'))) {
              hasInterface = true;
            }
          }
          if (device.kind === 'audiooutput') {
            hasOutput = true;
          }
        }

        let hasMidi = false;
        if (navigator.requestMIDIAccess) {
          try {
            if (!midiAccessRef) {
              midiAccessRef = await navigator.requestMIDIAccess({ sysex: false });
              midiAccessRef.onstatechange = (e) => {
                if (mounted) {
                   setHardware(prev => ({ ...prev, midi: e.currentTarget.inputs.size > 0 }));
                }
              };
            }
            hasMidi = midiAccessRef.inputs.size > 0;
          } catch (e) {
            console.warn("MIDI access denied or unsupported");
          }
        }

        if (mounted) {
          setHardware({
            mic: hasMic,
            interface: hasInterface,
            output: hasOutput,
            midi: hasMidi
          });
        }
      } catch (err) {
        console.error("Hardware detection error:", err);
      }
    };

    checkDevices();
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', checkDevices);
    }
    
    return () => {
      mounted = false;
      if (navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', checkDevices);
      }
      if (midiAccessRef) {
        midiAccessRef.onstatechange = null;
      }
    };
  }, []);

  const stopRecordingProcess = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const audioUrl = URL.createObjectURL(blob);
        
        let realWaveform = generateWaveform(8000);
        let recordedDuration = null;
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          recordedDuration = audioBuffer.duration;
          const channelData = audioBuffer.getChannelData(0);
          
          // Max efficiency waveform generation using Float32Array and striding
          const numPoints = 8000;
          const blockSize = Math.max(1, Math.floor(channelData.length / numPoints));
          const stride = Math.max(1, Math.floor(blockSize / 64)); // Sample max 64 points per block to prevent blocking main thread
          
          const waveform = new Float32Array(numPoints);
          let maxVal = 0;
          
          // Use peak (max) amplitude per block, not the average — an average smooths away
          // the real transients/peaks, making the waveform look nothing like the actual recording.
          for (let i = 0; i < numPoints; i++) {
            let start = i * blockSize;
            let peak = 0;
            for (let j = 0; j < blockSize; j += stride) {
              const abs = Math.abs(channelData[start + j] || 0);
              if (abs > peak) peak = abs;
            }
            waveform[i] = peak;
            if (peak > maxVal) maxVal = peak;
          }
          
          realWaveform = maxVal > 0 ? Array.from(waveform).map(v => v / maxVal) : Array.from(waveform).map(() => 0.05);
        } catch (e) {
          console.error("Failed to parse waveform", e);
        }
        
        setTracksWithHistory(prev => prev.map(t => {
          if (t.armed) {
            return { 
              ...t, 
              waveform: realWaveform, 
              armed: false, 
              audioUrl, 
              startTime: recordingStartTime !== null ? recordingStartTime : currentTimeRef.current,
              duration: recordedDuration || (recordingStartTime !== null ? Math.max(1, currentTimeRef.current - recordingStartTime) : 10)
            };
          }
          return t;
        }));
        setRecordingStartTime(null);
        toast.success("Recording saved!");
      };
      mediaRecorderRef.current.stop();
    } else {
      setTracksWithHistory(prev => prev.map(t => {
        if (t.armed) {
          return { ...t, waveform: [], armed: false };
        }
        return t;
      }));
      setRecordingStartTime(null);
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    recordingStartRealRef.current = null;
    // Stop overdub playback when recording ends
    Object.values(audioElementsRef.current).forEach(audio => audio.pause());
    sounds.recStop();
  };

  const toggleRecord = async () => {
    if (!isRecording && !tracks.some(t => t.armed)) {
      toast.error("Please arm at least one track to record (click the circle icon on a track)");
      return;
    }
    if (isPlaying) setIsPlaying(false);

    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: false, 
            noiseSuppression: false,
            autoGainControl: false,
            latency: 0
          } 
        });
        mediaStreamRef.current = stream;

        // Overdub: play back existing (non-armed) tracks while recording
        tracks.forEach(track => {
          if (!track.armed && track.audioUrl && (!track.muted || track.solo)) {
            let audio = audioElementsRef.current[track.id];
            if (!audio || audio.src !== track.audioUrl) {
              audio = new Audio(track.audioUrl);
              audioElementsRef.current[track.id] = audio;
            }
            audio.currentTime = currentTimeRef.current;
            audio.volume = track.muted ? 0 : ((track.volume / 100) * (masterVolume / 100));
            audio.play().catch(e => console.error("Overdub playback error:", e));
          }
        });
        
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        liveWaveformRef.current = [];
        recordingStartRealRef.current = performance.now();

        // Monitor audio with reduced volume to prevent loud feedback
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.0; // Disabled by default to prevent nasty feedback loops
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Start actual recording with frequent chunks for memory efficiency
        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : {};
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.start(200); // 200ms chunks to reduce memory spikes
        
        setIsRecording(true);
        setRecordingStartTime(currentTimeRef.current);
        setActivity("Recording 🎙️");
        toast.success("Recording started (Mic active)");
        sounds.recStart();
      } catch (err) {
        toast.error("Microphone access denied. Please allow mic permissions in your browser.");
        console.error(err);
      }
    } else {
      setIsRecording(false);
      stopRecordingProcess();
    }
  };

  const stop = () => {
    setIsPlaying(false);
    if (isRecording) { setIsRecording(false); stopRecordingProcess(); } else { sounds.recStop(); }
    Object.values(audioElementsRef.current).forEach(a => { a.pause(); a.currentTime = 0; });
    setTimeout(() => updateCurrentTime(0), 10);
  };

  // Keyboard shortcuts for Power Users
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      else if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'Numpad0') { e.preventDefault(); stop(); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); toggleRecord(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { if (selectedTrackIds.length > 0) { e.preventDefault(); deleteSelectedTracks(); } }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicateSelectedTracks(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); splitSelectedTracks(); }
      else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); selectedTrackIds.forEach(id => toggleTrackProperty(id, 'locked')); }
      else if (e.shiftKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); addTrack(); }
      else if (e.shiftKey && e.key === '1') { e.preventDefault(); setEditMode('shuffle'); }
      else if (e.shiftKey && e.key === '2') { e.preventDefault(); setEditMode('slip'); }
      else if (e.shiftKey && e.key === '3') { e.preventDefault(); setEditMode('grid'); }
      else if (e.shiftKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); selectedTrackIds.forEach(id => toggleSolo(id)); }
      else if (e.shiftKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); selectedTrackIds.forEach(id => toggleMute(id)); }
      else if (e.key === 't' || e.key === 'T') setActiveTool('trim');
      else if (e.key === 'c' || e.key === 'C') setActiveTool('cut');
      else if (e.key === 'g' || e.key === 'G') setActiveTool('grab');
      else if (e.key === 'f' || e.key === 'F') setActiveTool('fade');
      else if (e.key === 'e' || e.key === 'E') setActiveTool('smart');
      else if (e.key === 'Home') { e.preventDefault(); updateCurrentTime(0); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); setLoopActive(!loopActive); }
      else if (e.shiftKey && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); handleSeparateStems(); }
      else if (e.shiftKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); handleGenerateMelody(); }
      else if (e.key === 'ArrowRight' && !e.shiftKey) { e.preventDefault(); const step = 1 / (20 * zoom); updateCurrentTime(Math.min(100, currentTimeRef.current + step)); }
      else if (e.key === 'ArrowLeft' && !e.shiftKey) { e.preventDefault(); const step = 1 / (20 * zoom); updateCurrentTime(Math.max(0, currentTimeRef.current - step)); }
      else if (e.key === 'ArrowRight' && e.shiftKey && selectedTrackIds.length > 0) { e.preventDefault(); const nudge = 1 / (20 * zoom); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, startTime: Math.max(0, (t.startTime || 0) + nudge) } : t)); }
      else if (e.key === 'ArrowLeft' && e.shiftKey && selectedTrackIds.length > 0) { e.preventDefault(); const nudge = 1 / (20 * zoom); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, startTime: Math.max(0, (t.startTime || 0) - nudge) } : t)); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isRecording, togglePlay, toggleRecord, selectedTrackIds, tracks, activeTool]);

  const toggleMute = (trackId) => {
    sounds.click();
    // Mute and Solo are mutually exclusive — enabling mute clears solo.
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted, solo: !t.muted ? false : t.solo } : t));
  };

  const toggleSolo = (trackId) => {
    sounds.click();
    // Mute and Solo are mutually exclusive — enabling solo clears mute.
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, solo: !t.solo, muted: !t.solo ? false : t.muted } : t));
  };

  const toggleArm = (trackId) => {
    sounds.click();
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, armed: !t.armed } : t));
  };

  const updateVolume = (trackId, val) => {
    setTracks(tracks.map(t => t.id === trackId ? { ...t, volume: val[0] } : t));
  };

  const handleTrackClick = (e, trackId) => {
    if (e.ctrlKey || e.metaKey) {
      if (selectedTrackIds.includes(trackId)) {
        setSelectedTrackIds(selectedTrackIds.filter(id => id !== trackId));
      } else {
        setSelectedTrackIds([...selectedTrackIds, trackId]);
      }
    } else {
      setSelectedTrackIds([trackId]);
    }
  };

  const deleteSelectedTracks = () => {
    if (selectedTrackIds.length === 0) return;
    sounds.error();
    selectedTrackIds.forEach(id => {
      if (audioElementsRef.current[id]) {
        audioElementsRef.current[id].pause();
        delete audioElementsRef.current[id];
      }
    });
    setTracksWithHistory(tracks.filter(t => !selectedTrackIds.includes(t.id)));
    setSelectedTrackIds([]);
    toast.success("Selected tracks deleted");
  };

  const duplicateSelectedTracks = () => {
    if (selectedTrackIds.length === 0) return;
    sounds.success();
    
    if (tracks.length + selectedTrackIds.length > maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
      return;
    }

    const newTracks = [];
    let nextId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;

    tracks.forEach(t => {
      if (selectedTrackIds.includes(t.id)) {
        newTracks.push({
          ...t,
          id: nextId++,
          name: `${t.name} (Copy)`
        });
      }
    });

    setTracksWithHistory([...tracks, ...newTracks]);
    setSelectedTrackIds([]);
    toast.success("Tracks duplicated");
  };

  const deleteTrack = (trackId) => {
    if (audioElementsRef.current[trackId]) { audioElementsRef.current[trackId].pause(); delete audioElementsRef.current[trackId]; }
    setTracksWithHistory(prev => prev.filter(t => t.id !== trackId)); setSelectedTrackIds(prev => prev.filter(id => id !== trackId)); toast.success("Track deleted");
  };
  const duplicateTrack = (track) => {
    if (tracks.length >= maxTracks) return toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
    const nextId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
    setTracksWithHistory(prev => [...prev, { ...track, id: nextId, name: `${track.name} (Copy)` }]); toast.success("Track duplicated");
  };

  const splitSelectedTracks = () => {
    if (selectedTrackIds.length === 0) return;
    sounds.click();
    
    if (tracks.length + selectedTrackIds.length > maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
      return;
    }

    let nextId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
    let splitCount = 0;
    
    const newTracksList = [];

    const updatedTracks = tracks.map(t => {
      if (selectedTrackIds.includes(t.id) && t.waveform && t.waveform.length > 0) {
        const clipStart = t.startTime !== undefined ? t.startTime : 0;
        const clipDuration = t.duration !== undefined ? t.duration : 40;
        const clipEnd = clipStart + clipDuration;
        const curr = currentTimeRef.current;
        
        if (curr > clipStart && curr < clipEnd) {
          const splitDuration = curr - clipStart;
          
          splitCount++;
          
          newTracksList.push({
            ...t,
            id: nextId++,
            name: `${t.name} (Cut)`,
            startTime: curr,
            duration: clipDuration - splitDuration,
            fullDuration: t.fullDuration || t.duration,
            clipStart: (t.clipStart || 0) + splitDuration
          });
          
          return {
            ...t,
            duration: splitDuration,
            fullDuration: t.fullDuration || t.duration,
            clipStart: t.clipStart || 0
          };
        }
      }
      return t;
    });

    if (splitCount > 0) {
      setTracksWithHistory([...updatedTracks, ...newTracksList]);
      toast.success("Clip split at playhead");
    } else {
      toast.error("Playhead is not positioned over the selected clip");
    }
  };

  const addTrack = () => {
    sounds.click();
    setActivity("Adding a track ➕");
    if (tracks.length >= maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
      return;
    }
    const newId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
    setNewTrackName(`New Track ${newId}`);
    setNewTrackType('audio');
    setCreatingTrack(true);
  };
  const handleCreateTrackConfirm = () => {
    if (!newTrackName.trim()) return;
    const newId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
    setTracksWithHistory([...tracks, { id: newId, name: newTrackName.trim(), type: newTrackType, color: ["bg-green-500", "bg-blue-500", "bg-purple-500", "bg-yellow-500", "bg-pink-500"][newId % 5], volume: 75, pan: 50, muted: false, solo: false, armed: false, waveform: [], startTime: 0, duration: 0 }]);
    setCreatingTrack(false);
    toast.success("Track added");
  };

  const handleSeparateStems = async () => {
    if (selectedTrackIds.length === 0) {
      toast.error("Please select a track to separate");
      return;
    }
    const track = tracks.find(t => t.id === selectedTrackIds[0]);
    if (!track || !track.audioUrl) {
      toast.error("Selected track has no audio. Record or import audio first.");
      return;
    }
    if (tracks.length + 2 > maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
      return;
    }
    setIsProcessing('separate');
    const toastId = toast.loading("Analyzing and separating audio stems...");
    
    if (track.audioUrl.includes('actions.google.com')) {
      toast.error("Demo tracks are not suitable for stem separation. Please import your own audio files.", { id: toastId });
      setIsProcessing(null);
      return;
    }

    try {
      const { vocals, instrumental } = await separateStems(track.audioUrl);
      let nextId = Math.max(...tracks.map(t => t.id)) + 1;
      setTracksWithHistory(prev => [...prev,
        { ...track, id: nextId, name: `${track.name} (Vocals/Highs)`, color: "bg-green-500", audioUrl: vocals.url, waveform: vocals.waveform, duration: vocals.duration, startTime: track.startTime || 0, segments: undefined, effects: undefined },
        { ...track, id: nextId + 1, name: `${track.name} (Instrumental/Lows)`, color: "bg-green-500", audioUrl: instrumental.url, waveform: instrumental.waveform, duration: instrumental.duration, startTime: track.startTime || 0, segments: undefined, effects: undefined }
      ]);
      toast.success("Stems separated successfully!", { id: toastId });
    } catch (e) {
      console.error("Stem separation error:", e);
      toast.error(
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-red-500">Stem Separation Failed</span>
          <span className="text-xs opacity-90">We couldn't process this track. Ensure it's a valid WAV or MP3 file and try again.</span>
          {e.message && <span className="text-[10px] bg-black/20 p-1.5 rounded font-mono mt-1 overflow-x-auto text-red-400">{e.message}</span>}
        </div>, 
        { id: toastId, duration: 8000 }
      );
    } finally {
      setIsProcessing(null);
    }
  };

  const handleGenerateMelody = async () => {
    if (tracks.length >= maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
      return;
    }
    setIsProcessing('generate');
    toast.info("Generating melody...");
    try {
      const { url, waveform, duration } = await generateMelody({ seconds: 8, bpm: 120 });
      const newId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
      const colors = ["bg-green-500"];
      setTracksWithHistory(prev => [...prev, {
        id: newId,
        name: "Generated Melody",
        color: colors[newId % colors.length],
        volume: 75, pan: 50, muted: false, solo: false, armed: false,
        waveform, startTime: 0, duration, audioUrl: url,
        locked: false, grouped: false, showAutomation: false, elasticAudio: false, fadeIn: 0, fadeOut: 0
      }]);
      toast.success("Melody generated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate melody.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSave = async () => {
    try {
      localStorage.setItem('nalistudio_project_autosave', JSON.stringify(tracks));
      if (roomId) {
        await base44.entities.Project.update(roomId, {
          title: projectName,
          bpm: bpm,
          key: songKey
        });
      }
      toast.success("Project saved successfully!");
    } catch (e) {
      toast.error("Failed to save project.");
    }
  };

  const handleImportClick = () => {
    setShowImportDialog(true);
  };

  const decodeWaveform = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const numPoints = 8000;
      const blockSize = Math.max(1, Math.floor(channelData.length / numPoints));
      const stride = Math.max(1, Math.floor(blockSize / 64));
      const waveform = new Float32Array(numPoints);
      let maxVal = 0;
      for (let i = 0; i < numPoints; i++) {
        const start = i * blockSize;
        let sum = 0, samples = 0;
        for (let j = 0; j < blockSize; j += stride) {
          sum += Math.abs(channelData[start + j] || 0);
          samples++;
        }
        const val = sum / (samples || 1);
        waveform[i] = val;
        if (val > maxVal) maxVal = val;
      }
      audioCtx.close();
      const normalized = maxVal > 0 ? Array.from(waveform).map(v => v / maxVal) : Array.from(waveform).map(() => 0.05);
      return { waveform: normalized, duration: audioBuffer.duration };
    } catch (err) {
      console.error("Failed to decode audio file", err);
      return { waveform: generateWaveform(8000), duration: 40 };
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (tracks.length >= maxTracks) {
        toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
        e.target.value = null;
        return;
      }
      
      const newId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
      const colors = ["bg-green-500"];
      const fileUrl = URL.createObjectURL(file);

      toast.info(`Importing ${file.name}...`);
      const { waveform, duration } = await decodeWaveform(file);
      
      setTracksWithHistory([...tracks, {
        id: newId,
        name: file.name,
        color: colors[newId % colors.length],
        volume: 75,
        pan: 50,
        muted: false,
        solo: false,
        armed: false,
        waveform,
        startTime: 0,
        duration: Math.max(1, duration),
        audioUrl: fileUrl,
        locked: false,
        grouped: false,
        showAutomation: false,
        elasticAudio: false,
        fadeIn: 0,
        fadeOut: 0
      }]);
      toast.success(`Imported ${file.name}`);
      e.target.value = null;
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('wav');

  const handleDownloadMix = async (format = 'wav') => {
    if (!tracks.some(t => t.audioUrl)) {
      toast.error("No audio to export. Record or import a track first.");
      return;
    }
    setIsDownloading(true);
    toast.info(`Rendering your mix to ${format.toUpperCase()}...`);
    try {
      const blob = format === 'mp3' ? await renderMixToMp3(tracks) : await renderMixToWav(tracks);
      if (!blob) {
        toast.error("Nothing to export (all tracks muted or empty).");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NaliStudio Mix ${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      sounds.success();
      toast.success("Mix downloaded to your device!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export mix.");
    } finally {
      setIsDownloading(false);
    }
  };

  // handleExport removed in favor of BounceDialog

  if (showWelcome) return <StudioWelcome hasAutosave={hasAutosave} handleStartBlank={handleStartBlank} handleLoadAutosave={handleLoadAutosave} handleLoadDemo={handleLoadDemo} navigate={navigate} />;

  return (
    <div className="flex flex-col h-screen bg-[#0D0B14] text-foreground overflow-hidden relative">
      {/* Ambient stage glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-[32rem] h-[32rem] rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Top Toolbar */}
      <div className="min-h-[4rem] py-2 mx-2 sm:mx-3 mt-2 sm:mt-3 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-2 pl-2 sm:pl-4 pr-2 shrink-0 relative z-10">
        <div className="flex items-center gap-4 shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => { handleSave(); navigate('/'); }} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Exit Studio</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="font-heading font-black text-base sm:text-xl tracking-tight flex items-center gap-2">
            <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span className="text-gradient-animate hidden xs:inline sm:inline">NaliStudio</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 border-l border-border/50 text-sm group">
            <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} onFocus={(e) => e.target.select()} className="bg-transparent border-none focus:outline-none focus:ring-0 text-foreground font-medium w-48 truncate placeholder:text-muted-foreground group-hover:bg-secondary/50 rounded px-1 transition-colors" placeholder="Project Name..." />
            <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-1 sm:gap-2 bg-background/50 p-1 sm:p-1.5 rounded-xl border border-border/50 shadow-inner shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Return to Zero (Home)" aria-label="Return to Zero (Home)" aria-keyshortcuts="Home" onClick={(e) => { updateCurrentTime(0); e.currentTarget.blur(); }} className="hidden sm:flex w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><Rewind className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Return to Zero <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Home</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Stop" aria-label="Stop" onClick={(e) => { stop(); e.currentTarget.blur(); }} className="w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><Square className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Stop <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Numpad 0</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Play/Pause (Space)" aria-label="Play/Pause (Space)" aria-keyshortcuts="Space" onClick={(e) => { togglePlay(); e.currentTarget.blur(); }} className={cn("w-12 h-12 rounded-lg transition-all", isPlaying ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>{isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1 fill-current" />}</Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">{isPlaying ? "Pause" : "Play"} <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Space</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Record (R)" aria-label="Record (R)" aria-keyshortcuts="R" onClick={toggleRecord} className={cn("w-12 h-12 rounded-lg transition-all relative overflow-hidden", isRecording ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-400" : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10")}>{isRecording && <span className="absolute inset-0 bg-red-500/20 animate-ping rounded-lg" />}<Circle className={cn("w-5 h-5", isRecording ? "fill-current" : "fill-current")} /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Record <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">R</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Toggle Loop Region" aria-label="Loop" onClick={(e) => { setLoopActive(!loopActive); e.currentTarget.blur(); }} className={cn("w-10 h-10 rounded-lg transition-all", loopActive ? "bg-blue-500/20 text-blue-500" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}><RefreshCw className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Toggle Loop <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+L</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Fast-forward" aria-label="Fast-forward" onClick={(e) => { updateCurrentTime(Math.min(100, currentTimeRef.current + 5)); e.currentTarget.blur(); }} className="hidden sm:flex w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground"><FastForward className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Fast-forward <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">→</kbd></TooltipContent></Tooltip>
          </TooltipProvider>
        </div>

        {/* Right Tools - Hardware & Export */}
        <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
          {/* Live Collaborators */}
          <LivePresenceBar peers={livePeers} />

          {/* Jam Room */}
          <div className="hidden lg:flex items-center gap-1 mr-2 border-r border-border/50 pr-3">
             <Button variant={jamRoomActive ? "default" : "ghost"} size="sm" onClick={() => setJamRoomActive(!jamRoomActive)} className={cn("gap-2 rounded-xl transition-colors", jamRoomActive ? "bg-primary hover:bg-primary/90 text-primary-foreground border-transparent" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
               <Users className="w-4 h-4" />
               {jamRoomActive ? "Jam Room Active" : "Start Jam Room"}
             </Button>
             {jamRoomActive && (
               <TooltipProvider delayDuration={200}>
                 <Tooltip>
                   <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" title={jamVideoActive ? "Turn Video Off" : "Turn Video On"} onClick={() => setJamVideoActive(!jamVideoActive)} className="w-8 h-8 rounded-lg hover:bg-secondary">
                       {jamVideoActive ? <Video className="w-4 h-4 text-primary" /> : <VideoOff className="w-4 h-4 text-muted-foreground" />}
                     </Button>
                   </TooltipTrigger>
                   <TooltipContent side="bottom" className="text-xs">{jamVideoActive ? "Turn Video Off" : "Turn Video On"}</TooltipContent>
                 </Tooltip>
               </TooltipProvider>
             )}
          </div>

          {/* Quality, Shortcuts & Hardware Config */}
          <div className="hidden lg:flex items-center gap-1 mr-2 border-r border-border/50 pr-3">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                  <Activity className="w-4 h-4" /> Quality
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[280px] bg-card border-border">
                <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-muted-foreground">Audio Quality Settings</div>
                {[
                  { sr: "44.1 kHz", bd: "16-bit", desc: "Standard CD Quality (Low CPU)" },
                  { sr: "44.1 kHz", bd: "24-bit", desc: "Studio Standard (Moderate CPU)" },
                  { sr: "48 kHz", bd: "24-bit", desc: "Video Standard (Moderate CPU)" },
                  { sr: "88.2 kHz", bd: "24-bit", desc: "High Res (High CPU)" },
                  { sr: "96 kHz", bd: "24-bit", desc: "High Res / Video (High CPU)" },
                  { sr: "96 kHz", bd: "32-bit float", desc: "Pro High Res (Very High CPU/Storage)" },
                  { sr: "192 kHz", bd: "32-bit float", desc: "Audiophile (Extreme CPU/Storage)" }
                ].map((s, i) => {
                  const isActive = audioSettings.sampleRate === s.sr && audioSettings.bitDepth === s.bd;
                  return (
                    <DropdownMenuItem key={i} onClick={() => setAudioSettings({ ...audioSettings, sampleRate: s.sr, bitDepth: s.bd })} className={cn("cursor-pointer flex-col items-start gap-1 py-1.5", isActive && "bg-primary/10 focus:bg-primary/20")}>
                      <div className="flex items-center justify-between w-full text-xs">
                        <span className={cn(isActive ? "font-bold text-primary" : "font-medium")}>{s.sr} / {s.bd}</span>
                        {isActive && <Check className="w-3 h-3 text-primary" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={() => setShowShortcutsDialog(true)} className={cn("gap-2 rounded-lg transition-colors", showShortcutsDialog ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
              <Keyboard className="w-4 h-4" /> Shortcuts
            </Button>
            <Button variant="ghost" size="sm" title="Hardware Preferences" onClick={() => { stop(); setShowPreferencesDialog(true); }} className="gap-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
              <Settings2 className="w-4 h-4" /> Hardware
            </Button>
          </div>

          <div className="font-mono text-sm sm:text-xl text-primary font-bold bg-[#0a0a0c] px-2 sm:px-4 py-1.5 rounded-lg border border-border w-32 sm:w-44 text-center shadow-inner tracking-tight sm:tracking-normal relative group shrink-0">
            <span ref={timeDisplayRef}>{formatTime(currentTimeRef.current)}</span>
            {isRecording && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </div>


          <div className="flex flex-wrap items-center justify-end gap-2 pl-2 min-w-0">
            <input type="file" ref={fileInputRef} className="hidden" accept="audio/*,.wav,.wave,.mp3,.mid,.midi,.flac,.ogg,.m4a,.aac,.wma,.aiff,.aif" onChange={handleFileChange} />
            <Button id="milestones-btn" onClick={() => setShowMilestones(true)} variant="outline" size="sm" className="gap-2 rounded-xl border-border/50 hover:bg-secondary transition-colors">
              <ListTodo className="w-4 h-4" /> Milestones
            </Button>
            <Button onClick={() => setShowQuickMemo(true)} variant="outline" size="sm" className="gap-2 rounded-xl border-primary/50 text-primary hover:bg-primary/10 transition-colors">
               <Mic className="w-4 h-4" /> Quick Memo
            </Button>
            <Button variant="outline" className="gap-2 rounded-xl border-border/50" onClick={handleImportClick}>
              <Upload className="w-4 h-4" /> Upload Files
            </Button>
            <Button variant="outline" className="gap-2 rounded-xl border-border/50" onClick={handleSave}>
              <Save className="w-4 h-4" /> Save
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild><Button className="gap-2 rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary"><Download className="w-4 h-4" /> Export</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setExportFormat('wav'); setExportDialogOpen(true); }} className="cursor-pointer py-2"><Download className="w-4 h-4 mr-2" /> Download Mix (WAV)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setExportFormat('mp3'); setExportDialogOpen(true); }} className="cursor-pointer py-2"><Download className="w-4 h-4 mr-2" /> Download Mix (MP3)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setBounceRedirect('explore'); setBounceOpen(true); }} className="cursor-pointer py-2"><Download className="w-4 h-4 mr-2" /> Export & Publish</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setBounceRedirect('cover-art'); setBounceOpen(true); }} className="cursor-pointer py-2"><ImageIcon className="w-4 h-4 mr-2" /> Export to Cover Creator</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <BounceDialog
              open={bounceOpen}
              onOpenChange={setBounceOpen}
              projectTitle="Untitled Studio Project"
              project={{ genre: "Electronic", bpm: 120 }}
              tracks={tracks}
              redirectAfter={bounceRedirect}
            />
            <div className="border-l border-border/50 h-6 mx-1"></div>
            <button
              onClick={() => window.dispatchEvent(new Event('open-ai-assistant'))}
              title="NALI.ai Assistant"
              className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-white bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <AudioLines className="w-4 h-4 animate-pulse" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar 2 (Tools) */}
      <StudioToolbar2
        addTrack={addTrack} selectedTrackIds={selectedTrackIds} tracks={tracks}
        handleSeparateStems={handleSeparateStems} isProcessing={isProcessing} handleGenerateMelody={handleGenerateMelody}
        undo={undo} redo={redo} historyIndex={historyIndex} historyLength={historyRef.current.length}
        bpm={bpm} setBpm={setBpm} bpmInput={bpmInput} setBpmInput={setBpmInput} timeSignature={timeSignature} setTimeSignature={setTimeSignature}
        songKey={songKey} setSongKey={setSongKey}
        editMode={editMode} setEditMode={setEditMode} activeTool={activeTool} setActiveTool={setActiveTool}
        toggleTrackProperty={toggleTrackProperty} splitSelectedTracks={splitSelectedTracks} duplicateSelectedTracks={duplicateSelectedTracks}
        deleteSelectedTracks={deleteSelectedTracks} zoom={zoom} setZoom={setZoom}
      />
      {/* setEditingTrack prop removed — Wave Editor was merged into this inline timeline */}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden bg-black/40 backdrop-blur-sm relative z-10 mx-2 sm:mx-3 rounded-2xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        {/* Jam Room Floating Overlay */}
        <JamRoomOverlay jamRoomActive={jamRoomActive} defaultRole={defaultRole} setDefaultRole={setDefaultRole} />
        {/* Track Headers (Left Sidebar) */}
        <div className="w-44 sm:w-72 md:w-96 border-r border-white/10 bg-white/[0.03] backdrop-blur-md flex flex-col overflow-y-auto z-10 custom-scrollbar shrink-0 rounded-l-2xl">
          <DragDropContext onDragEnd={handleReorderTracks}>
            <Droppable droppableId="studio-track-headers">
              {(dropProvided) => (
                <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                  {tracks.map((track, index) => (
                    <Draggable key={track.id} draggableId={String(track.id)} index={index} isDragDisabled={isRecording}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          onClick={(e) => handleTrackClick(e, track.id)}
                          style={{ ...dragProvided.draggableProps.style, height: track.height ? `${track.height}px` : (track.showAutomation ? '176px' : '112px') }}
                          className={cn(
                            "border-b border-border/40 p-3 flex flex-col justify-between transition-none cursor-pointer border-l-4 relative group/header",
                            track.muted ? "bg-card/30 opacity-70" : "bg-card/80 hover:bg-secondary/40",
                            selectedTrackIds.includes(track.id) ? "border-l-primary bg-primary/20 shadow-[inset_0_0_30px_hsl(var(--primary)/0.15)]" : "border-l-transparent",
                            dragSnapshot.isDragging && "shadow-xl ring-1 ring-primary/40 bg-secondary/60"
                          )}
                        >
                <div className="flex items-start justify-between">
                  <div className="flex items-center mr-2">
                    <span
                      {...dragProvided.dragHandleProps}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 -ml-1 mr-1 p-0.5 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                      title="Drag to reorder track"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <div className={cn("w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold shadow-sm", track.muted ? "bg-muted-foreground/30 text-muted-foreground" : `${track.color} text-white`)}>
                        {index + 1}
                      </div>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate max-w-[100px] sm:max-w-none sm:whitespace-pre-wrap sm:break-words text-xs font-semibold cursor-help" title={track.name}>{track.name}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px] break-words">{track.name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Select 
                        value={track.inputType || ((track.name || "").toLowerCase().includes("beat") || (track.name || "").toLowerCase().includes("instrumental") ? "Internal Audio" : "In: Default Mic")}
                        onValueChange={(val) => setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, inputType: val } : t))}
                      >
                        <SelectTrigger className={cn("h-4 p-0 border-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 shadow-none font-mono text-[9px] w-max min-w-[120px] max-w-[160px] truncate flex items-center justify-between gap-0.5 [&>svg]:w-2.5 [&>svg]:h-2.5 m-0 mt-0.5 outline-none transition-colors", (track.inputType || ((track.name || "").toLowerCase().includes("beat") || (track.name || "").toLowerCase().includes("instrumental") ? "Internal Audio" : "In: Default Mic")) !== "Internal Audio" ? "text-primary hover:text-primary/80 font-bold" : "text-muted-foreground hover:text-foreground")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="In: Default Mic">In: Default Mic</SelectItem>
                          <SelectItem value="In: Audio Interface">In: Audio Interface</SelectItem>
                          <SelectItem value="In: MIDI Keyboard">In: MIDI Keyboard</SelectItem>
                          <SelectItem value="Internal Audio">Internal Audio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleTrackProperty(track.id, 'elasticAudio') }} className={cn("hidden lg:flex h-6 px-1.5 gap-1 text-muted-foreground hover:text-foreground", track.elasticAudio && "text-primary")}><Activity className="w-3 h-3" /><span className="text-[9px]">Warp</span></Button></TooltipTrigger><TooltipContent side="top" className="text-xs">Elastic Audio</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleTrackProperty(track.id, 'showAutomation') }} className={cn("hidden xl:flex h-6 px-1.5 gap-1 text-muted-foreground hover:text-foreground", track.showAutomation && "text-primary")}><TrendingUp className="w-3 h-3" /><span className="text-[9px]">Auto</span></Button></TooltipTrigger><TooltipContent side="top" className="text-xs">Show Automation</TooltipContent></Tooltip>
                    </TooltipProvider>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" title="Track Options" onClick={(e) => e.stopPropagation()} className="w-6 h-6 text-muted-foreground hover:text-foreground"><Settings2 className="w-3.5 h-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onSelect={() => {
                          setRenamingTrack({ ...track, isNew: false });
                          setNewTrackName(track.name);
                        }}>
                          <PenTool className="w-4 h-4 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => duplicateTrack(track)}>
                          <Copy className="w-4 h-4 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => deleteTrack(track.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip><TooltipTrigger asChild>
                      <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <button 
                          onClick={() => toggleMute(track.id)}
                          className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all border", track.muted ? "bg-red-500 text-white border-red-500" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground")}
                        >
                          M
                        </button>
                      </div>
                    </TooltipTrigger><TooltipContent side="top" className="text-xs flex items-center gap-1">Mute Track <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+M</kbd></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <button 
                          onClick={() => toggleSolo(track.id)}
                          className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all border", track.solo ? "bg-yellow-500 text-white border-yellow-500" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground")}
                        >
                          S
                        </button>
                      </div>
                    </TooltipTrigger><TooltipContent side="top" className="text-xs flex items-center gap-1">Solo Track <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+S</kbd></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <button 
                          onClick={() => {
                             const input = track.inputType || ((track.name || "").toLowerCase().includes("beat") || (track.name || "").toLowerCase().includes("instrumental") ? "Internal Audio" : "In: Default Mic");
                             if (input === 'Internal Audio') {
                                toast.error("Cannot arm a track set to Internal Audio");
                                return;
                             }
                             toggleArm(track.id);
                          }}
                          className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center justify-center border focus:outline-none", track.armed ? "bg-red-500 text-white border-red-500" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground", ((track.inputType || ((track.name || "").toLowerCase().includes("beat") || (track.name || "").toLowerCase().includes("instrumental") ? "Internal Audio" : "In: Default Mic")) === 'Internal Audio') && "opacity-30 cursor-not-allowed")}
                        >
                          <Circle className="w-3 h-3 fill-current" />
                        </button>
                      </div>
                    </TooltipTrigger><TooltipContent side="top" className="text-xs">Arm for Recording</TooltipContent></Tooltip>
                  </TooltipProvider>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <Slider 
                    value={[track.volume]} 
                    max={100} 
                    step={1} 
                    onValueChange={(val) => updateVolume(track.id, val)}
                    onValueCommit={() => pushToHistory(tracksRef.current)}
                    className="flex-1"
                  />
                </div>
                {/* Resize Handle */}
                <div 
                  className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-primary/50 z-30 opacity-0 group-hover/header:opacity-100 transition-opacity" 
                  title="Adjust track height"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const startY = e.clientY;
                    const startHeight = track.height || (track.showAutomation ? 176 : 112);
                    const handleMove = (moveEvent) => {
                      const newHeight = Math.max(64, Math.min(400, startHeight + (moveEvent.clientY - startY)));
                      setTracks(prev => prev.map(t => t.id === track.id ? { ...t, height: newHeight } : t));
                    };
                    const handleUp = () => {
                      window.removeEventListener('pointermove', handleMove);
                      window.removeEventListener('pointerup', handleUp);
                    };
                    window.addEventListener('pointermove', handleMove);
                    window.addEventListener('pointerup', handleUp);
                  }}
                />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {dropProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          {/* Empty space filler */}
          <div className="flex-1 bg-card/20 min-h-[100px]" />
        </div>

        {/* Timeline & Waveforms (Right Area) */}
        <div className="flex-1 relative overflow-auto custom-scrollbar flex flex-col bg-gradient-to-b from-[#12101C]/80 to-[#0B0912]/90 rounded-r-2xl">
          {/* Timeline Header */}
          <div className="h-8 border-b border-white/10 bg-white/[0.04] backdrop-blur-md sticky top-0 z-20 flex items-end px-0 overflow-hidden timeline-ruler">
            {(() => { const projectEnd = Math.max(...tracks.map(t => (t.startTime || 0) + (t.duration || 0)), 20); return <div className="absolute top-0 bottom-0 w-[2px] bg-red-500/50 z-10 pointer-events-none" style={{ left: `${projectEnd * 20 * zoom}px` }}><div className="absolute top-0 -translate-x-1/2 bg-red-500/80 text-white text-[8px] px-1 rounded-b shadow-md font-bold">END</div></div>; })()}
            <div className="h-full relative cursor-pointer select-none" style={{ width: `${2000 * zoom}px`, minWidth: `${2000 * zoom}px` }}
              onPointerDown={(e) => {
                const target = e.currentTarget;
                const updatePosition = (cX, cY) => { const t = Math.max(0, (cX - target.getBoundingClientRect().left) / (20 * zoom)); updateCurrentTime(t); showEditTooltip(cX, cY, t); };
                updatePosition(e.clientX, e.clientY);
                const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
                const handleUp = () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); hideEditTooltip(); };
                window.addEventListener('pointermove', handleMove); window.addEventListener('pointerup', handleUp);
              }}
            >
              {loopActive && (
                <div className="absolute bottom-0 h-full bg-blue-500/10 border-x-2 border-blue-500 pointer-events-none z-10" style={{ left: 0, width: `${(60/bpm) * parseInt(timeSignature.split('/')[0]||4) * 4 * 20 * zoom}px` }}>
                  <div className="absolute top-0 left-0 bg-blue-500 text-white text-[8px] px-1 rounded-br font-bold shadow-md">LOOP START</div>
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-[8px] px-1 rounded-bl font-bold shadow-md">LOOP END</div>
                </div>
              )}
              {Array.from({ length: Math.max(1000, Math.ceil(2000/(60/bpm))) }).slice(0, 2000).map((_, i) => {
                const beatsPerBar = parseInt(timeSignature.split('/')[0]) || 4;
                const secondsPerBeat = 60 / bpm;
                const position = i * secondsPerBeat * 20 * zoom;
                const barNumber = Math.floor(i / beatsPerBar) + 1;
                const beatNumber = (i % beatsPerBar) + 1;
                const isBar = beatNumber === 1;
                const showBeats = zoom > 1.5;
                
                if (!isBar && !showBeats) return null;

                return (
                  <div 
                    key={i} 
                    className={cn("absolute bottom-0 text-[10px] text-muted-foreground border-l border-border/60 pl-1", isBar ? "h-4 font-semibold" : "h-2")} 
                    style={{ left: `${position}px` }}
                  >
                    {isBar ? barNumber : (showBeats && zoom > 3 ? `${barNumber}.${beatNumber}` : '')}
                  </div>
                );
              })}
              
              <div ref={headerPlayheadRef} className="absolute top-0 bottom-0 w-[2px] -ml-[1px] bg-primary z-50 pointer-events-none" style={{ left: `${currentTimeRef.current * 20 * zoom}px` }}>
                <div className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-primary rounded-b-sm flex items-center justify-center shadow-md" />
              </div>
            </div>
          </div>

          {/* Tracks Area */}
          <div style={{ width: `${2000 * zoom}px`, minWidth: `${2000 * zoom}px`, minHeight: '100%' }}>
            <div 
              className="relative w-full min-h-full cursor-text select-none" 
              onPointerDown={(e) => {
              if (e.target.closest('.audio-clip')) return;
              const target = e.currentTarget;
              const updatePosition = (clientX) => {
                const rect = target.getBoundingClientRect();
                const x = clientX - rect.left;
                updateCurrentTime(Math.max(0, x / (20 * zoom)));
              };
              updatePosition(e.clientX);
              
              const handleMove = (moveEvent) => updatePosition(moveEvent.clientX);
              const handleUp = () => {
                window.removeEventListener('pointermove', handleMove);
                window.removeEventListener('pointerup', handleUp);
              };
              window.addEventListener('pointermove', handleMove);
              window.addEventListener('pointerup', handleUp);
            }}
          >
            {loopActive && <div className="absolute top-0 bottom-0 bg-blue-500/10 border-x border-blue-500/50 pointer-events-none z-10" style={{ left: 0, width: `${(60/bpm) * parseInt(timeSignature.split('/')[0]||4) * 4 * 20 * zoom}px` }} />}
            {(() => { const projectEnd = Math.max(...tracks.map(t => (t.startTime || 0) + (t.duration || 0)), 20); return <div className="absolute top-0 bottom-0 w-[1px] bg-red-500/30 border-r border-red-500/10 pointer-events-none z-0" style={{ left: `${projectEnd * 20 * zoom}px` }} />; })()}
            {/* Waveform Rows */}
            <div className="flex flex-col">
              {tracks.map((track) => (
                <div 
                  key={track.id} 
                  onClick={(e) => handleTrackClick(e, track.id)}
                  style={{ height: track.height ? `${track.height}px` : (track.showAutomation ? '176px' : '112px') }}
                  className={cn(
                    "border-b border-border/20 relative group transition-none", 
                    track.muted ? "opacity-30" : "",
                    selectedTrackIds.includes(track.id) ? "bg-primary/15 shadow-[inset_0_0_30px_hsl(var(--primary)/0.1)]" : "",
                    tracks.some(t => t.solo) && !track.solo && "opacity-40 grayscale"
                  )}
                >
                  {/* Grid lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px)] opacity-30 pointer-events-none z-0" style={{ backgroundSize: `${(60 / bpm) * parseInt(timeSignature.split('/')[0] || 4) * 20 * zoom}px 100%` }} />
                  
                  {/* Automation Lane Background */}
                  {track.showAutomation && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 border-t border-white/5 bg-black/40 flex items-center justify-center">
                       <span className="text-[10px] text-muted-foreground/50">Volume & pan automation editing coming soon</span>
                    </div>
                  )}

                  {/* Armed / Recording Indicator */}
                  {track.armed && (
                    <div 
                      ref={el => { recordingIndicatorRefs.current[track.id] = el; }}
                      className={cn(
                        "absolute top-0 bottom-0 z-20 pointer-events-none transition-all overflow-hidden",
                        isRecording ? "border-l-2 border-red-500 bg-red-500/10" : "w-[2px] bg-red-500/50"
                      )}
                      style={{ 
                        left: `${(isRecording && recordingStartTime !== null ? recordingStartTime : currentTimeRef.current) * 20 * zoom}px`,
                        width: isRecording && recordingStartTime !== null ? `${Math.max(0, currentTimeRef.current - recordingStartTime) * 20 * zoom}px` : '2px'
                      }}
                    >
                      {isRecording && (
                        <canvas 
                          ref={el => { recordingCanvasRefs.current[track.id] = el; }} 
                          className="absolute top-0 bottom-0 left-0 h-full" 
                          width={20000}
                          height={200} 
                        />
                      )}
                      <div className={cn(
                        "absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap flex items-center gap-1",
                        isRecording ? "bg-red-500 animate-pulse" : "bg-red-500/80"
                      )}>
                        <Circle className={cn("w-2 h-2", isRecording ? "fill-current" : "")} />
                        {isRecording ? "RECORDING" : "REC START"}
                      </div>
                      {!isRecording && (
                        <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-red-500/20 to-transparent border-y border-l border-red-500/30 rounded-l-md" />
                      )}
                    </div>
                  )}
                  
                  {/* Empty track placeholder — clarifies the track exists but has no audio yet */}
                  {(!track.waveform || track.waveform.length === 0) && !track.armed && (
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 italic">
                        <Mic className="w-3.5 h-3.5 shrink-0" />
                        <span>Empty — upload a file or record to fill this track</span>
                      </div>
                    </div>
                  )}

                  {/* Audio Region (Clip) */}
                  {track.waveform && track.waveform.length > 0 && (
                    <div 
                      onPointerMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isTopHalf = (e.clientY - rect.top) < rect.height / 2;
                        if (activeTool === 'smart') {
                          e.currentTarget.style.cursor = isTopHalf ? 'text' : 'grab';
                        } else if (activeTool === 'grab') {
                          e.currentTarget.style.cursor = 'grab';
                        } else if (activeTool === 'cut') {
                          e.currentTarget.style.cursor = 'crosshair';
                        } else {
                          e.currentTarget.style.cursor = 'default';
                        }
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (track.locked || activeTool === 'fade') return;
                        
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isTopHalf = (e.clientY - rect.top) < rect.height / 2;

                        if (activeTool === 'cut') {
                           // Cut removes the audio after the click point (unlike Split, which
                           // keeps both halves as separate clips) — the clip is simply shortened.
                           const target = e.currentTarget;
                           const rect = target.getBoundingClientRect();
                           const clickX = e.clientX - rect.left;
                           const clickRatio = clickX / rect.width;
                           
                           const newDuration = track.duration * clickRatio;
                           
                           setTracksWithHistory(prev => prev.map(t => t.id === track.id ? {
                             ...t,
                             duration: newDuration,
                             fullDuration: t.fullDuration || t.duration,
                             clipStart: t.clipStart || 0
                           } : t));
                           toast.success("Audio after the cut point removed");
                           return;
                        }

                        if (activeTool === 'smart' && isTopHalf) {
                          const clickX = e.clientX - rect.left;
                          const clickRatio = clickX / rect.width;
                          const newTime = (track.startTime || 0) + ((track.duration || 40) * clickRatio);
                          updateCurrentTime(newTime);
                          return;
                        }

                        if (activeTool === 'grab' || (activeTool === 'smart' && !isTopHalf)) {
                          const target = e.currentTarget;
                          const startX = e.clientX;
                          const initialStartTime = track.startTime !== undefined ? track.startTime : 0;
                          target.setPointerCapture(e.pointerId);
                          let hasDragged = false;
                          
                          const handleMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            if (!hasDragged) {
                              if (Math.abs(deltaX) < 3) return; // Ignore tiny movement so a plain click doesn't highlight the clip
                              hasDragged = true;
                              Object.assign(target.style, { zIndex: '50', opacity: '0.9', filter: 'brightness(1.2)', boxShadow: '0 0 20px hsl(var(--primary)/0.5), inset 0 0 0 2px hsl(var(--primary))' });
                            }
                            const deltaTime = deltaX / (20 * zoom);
                            let newStartTime = Math.max(0, initialStartTime + deltaTime);
                            if (editMode === 'grid') newStartTime = Math.round(newStartTime / gridSize) * gridSize;
                            target.style.left = `${newStartTime * 20 * zoom}px`;
                            target.dataset.newStartTime = newStartTime;
                            showEditTooltip(moveEvent.clientX, moveEvent.clientY, newStartTime);
                          };
                          
                          const handleUp = (upEvent) => {
                            Object.assign(target.style, { zIndex: '', opacity: '', filter: '', boxShadow: '' });
                            target.releasePointerCapture(upEvent.pointerId);
                            target.removeEventListener('pointermove', handleMove);
                            target.removeEventListener('pointerup', handleUp);
                            hideEditTooltip();
                            if (target.dataset.newStartTime !== undefined) {
                              const newStartTime = parseFloat(target.dataset.newStartTime);
                              setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, startTime: newStartTime } : t));
                              delete target.dataset.newStartTime;
                            }
                          };
                          
                          target.addEventListener('pointermove', handleMove);
                          target.addEventListener('pointerup', handleUp);
                        }
                      }}
                      className="audio-clip absolute top-2 bottom-2 rounded-r-lg border border-white/10 bg-card/60 backdrop-blur overflow-hidden group-hover:border-white/30 transition-colors shadow-sm"
                      style={{ 
                        left: `${(track.startTime !== undefined ? track.startTime : 0) * 20 * zoom}px`,
                        width: `${(track.duration !== undefined ? track.duration : 40) * 20 * zoom}px`
                      }}
                    >
                      {/* Left Trim Handle */}
                      <div 
                        className={cn("absolute left-0 w-3 z-20 group/handle flex justify-start items-center bg-black/20", 
                          (activeTool === 'trim' || activeTool === 'smart') ? "cursor-col-resize hover:bg-white/40" : "pointer-events-none opacity-0",
                          activeTool === 'smart' ? "top-[50%] bottom-0" : "top-0 bottom-0"
                        )}
                        onPointerDown={(e) => {
                          if (activeTool !== 'trim' && activeTool !== 'smart') return;
                          e.stopPropagation();
                          const target = e.currentTarget;
                          const startX = e.clientX;
                          const initialStartTime = track.startTime !== undefined ? track.startTime : 0;
                          const initialDuration = track.duration !== undefined ? track.duration : 40;
                          const initialClipStart = track.clipStart || 0;
                          
                          target.setPointerCapture(e.pointerId);
                          
                          const MIN_CLIP_DURATION = 0.001; // 1ms — surgical-precision trim floor
                          const round = (v) => Math.round(v * 1000) / 1000; // snap to 1ms to avoid float drift
                          const handleMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaTime = round(deltaX / (20 * zoom));
                            
                            if (deltaTime < initialDuration - MIN_CLIP_DURATION) { 
                               // Don't allow left trim to go before the actual start of the audio file
                               const maxLeftTrim = -initialClipStart;
                               const trimAmount = Math.max(maxLeftTrim, deltaTime);
                               
                               setTracks(prev => prev.map(t => 
                                t.id === track.id ? { 
                                  ...t, 
                                  startTime: round(initialStartTime + trimAmount),
                                  duration: round(initialDuration - trimAmount),
                                  clipStart: round(initialClipStart + trimAmount)
                                  } : t
                                  ));
                                  showEditTooltip(moveEvent.clientX, moveEvent.clientY, initialStartTime + trimAmount);
                                  }
                                  };

                                  const handleUp = (upEvent) => {
                                  target.releasePointerCapture(upEvent.pointerId);
                                  target.removeEventListener('pointermove', handleMove);
                                  target.removeEventListener('pointerup', handleUp);
                                  pushToHistory(tracksRef.current);
                                  hideEditTooltip();
                                  };

                                  target.addEventListener('pointermove', handleMove);
                                  target.addEventListener('pointerup', handleUp);
                                            }}
                                          >
                                            <div className="w-[2px] h-4 bg-white/50 group-hover/handle:bg-white rounded-full" />
                                          </div>

                                          {/* Right Trim Handle */}
                      <div 
                        className={cn("absolute right-0 w-3 z-20 group/handle flex justify-end items-center bg-black/20", 
                          (activeTool === 'trim' || activeTool === 'smart') ? "cursor-col-resize hover:bg-white/40" : "pointer-events-none opacity-0",
                          activeTool === 'smart' ? "top-[50%] bottom-0" : "top-0 bottom-0"
                        )}
                        onPointerDown={(e) => {
                          if (activeTool !== 'trim' && activeTool !== 'smart') return;
                          e.stopPropagation();
                          const target = e.currentTarget;
                          const startX = e.clientX;
                          const initialDuration = track.duration !== undefined ? track.duration : 40;
                          const initialClipStart = track.clipStart || 0;
                          const fullDuration = track.fullDuration || track.duration || 40;
                          
                          target.setPointerCapture(e.pointerId);
                          
                          const MIN_CLIP_DURATION_R = 0.001; // 1ms — surgical-precision trim floor
                          const roundR = (v) => Math.round(v * 1000) / 1000; // snap to 1ms to avoid float drift
                          const handleMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaTime = roundR(deltaX / (20 * zoom));
                            
                            if (-deltaTime < initialDuration - MIN_CLIP_DURATION_R) {
                               // Allow dragging right to restore the audio, up to its full duration
                               const maxRightTrim = fullDuration - (initialClipStart + initialDuration);
                               const trimAmount = Math.max(-maxRightTrim, -deltaTime); 
                               
                               setTracks(prev => prev.map(t => 
                                t.id === track.id ? { 
                                  ...t, 
                                  duration: roundR(initialDuration - trimAmount)
                                  } : t
                                  ));
                                  showEditTooltip(moveEvent.clientX, moveEvent.clientY, (track.startTime || 0) + (initialDuration - trimAmount));
                                  }
                                  };

                                  const handleUp = (upEvent) => {
                                  target.releasePointerCapture(upEvent.pointerId);
                                  target.removeEventListener('pointermove', handleMove);
                                  target.removeEventListener('pointerup', handleUp);
                                  pushToHistory(tracksRef.current);
                                  hideEditTooltip();
                                  };
                          
                          target.addEventListener('pointermove', handleMove);
                          target.addEventListener('pointerup', handleUp);
                        }}
                      >
                        <div className="w-[2px] h-4 bg-white/50 group-hover/handle:bg-white rounded-full" />
                      </div>

                      <div className="absolute top-1 left-4 text-[10px] font-medium text-white/50 pointer-events-none flex items-center gap-1 truncate max-w-[90%]">
                        {track.name} - Take 1
                        {track.locked && <Link2 className="w-3 h-3 text-red-400" />}
                        {track.elasticAudio && <Activity className="w-3 h-3 text-blue-400" />}
                      </div>
                      
                      {/* Fade In/Out Overlays & Handles */}
                      <div 
                        className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none"
                        style={{ width: `${(track.fadeIn || 0) * 100}%` }}
                      />
                      {(activeTool === 'fade' || activeTool === 'smart') && (
                        <div className={cn("absolute w-6 hover:bg-white/10 flex justify-center group z-20 pointer-events-auto",
                            activeTool === 'smart' ? "top-0 bottom-[50%] items-start cursor-crosshair" : "top-0 bottom-0 items-center cursor-ew-resize"
                          )}
                          style={{ left: `calc(${(track.fadeIn || 0) * 100}% - 12px)` }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const target = e.currentTarget;
                            const container = target.parentElement;
                            const rect = container.getBoundingClientRect();
                            target.setPointerCapture(e.pointerId);
                            
                            const handleMove = (moveEvent) => {
                              const currentX = Math.max(0, Math.min(1 - (track.fadeOut || 0), (moveEvent.clientX - rect.left) / rect.width));
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
                                setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, fadeIn: parseFloat(newFadeStr) } : t));
                                delete target.dataset.newFade;
                              }
                            };
                            
                            target.addEventListener('pointermove', handleMove);
                            target.addEventListener('pointerup', handleUp);
                          }}
                        >
                          <div className={cn("bg-white/50 group-hover:bg-white transition-colors shadow-sm",
                            activeTool === 'smart' ? "w-2 h-2 mt-1 rounded-sm border border-black/50" : "w-1 h-6 rounded-full"
                          )} />
                        </div>
                      )}

                      <div className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" style={{ width: `${(track.fadeOut || 0) * 100}%` }} />
                      {(activeTool === 'fade' || activeTool === 'smart') && (
                        <div className={cn("absolute w-6 hover:bg-white/10 flex justify-center group z-20 pointer-events-auto", activeTool === 'smart' ? "top-0 bottom-[50%] items-start cursor-crosshair" : "top-0 bottom-0 items-center cursor-ew-resize")}
                          style={{ right: `calc(${(track.fadeOut || 0) * 100}% - 12px)` }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const target = e.currentTarget;
                            const container = target.parentElement;
                            const rect = container.getBoundingClientRect();
                            target.setPointerCapture(e.pointerId);
                            const handleMove = (moveEvent) => {
                              const currentX = Math.max(0, Math.min(1 - (track.fadeIn || 0), 1 - ((moveEvent.clientX - rect.left) / rect.width)));
                              target.style.right = `calc(${currentX * 100}% - 12px)`;
                              if (target.previousElementSibling) target.previousElementSibling.style.width = `${currentX * 100}%`;
                              target.dataset.newFade = currentX;
                            };
                            const handleUp = (upEvent) => {
                              target.releasePointerCapture(upEvent.pointerId);
                              target.removeEventListener('pointermove', handleMove);
                              target.removeEventListener('pointerup', handleUp);
                              if (target.dataset.newFade !== undefined) {
                                setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, fadeOut: parseFloat(target.dataset.newFade) } : t));
                                delete target.dataset.newFade;
                              }
                            };
                            target.addEventListener('pointermove', handleMove);
                            target.addEventListener('pointerup', handleUp);
                          }}
                        >
                          <div className={cn("bg-white/50 group-hover:bg-white transition-colors shadow-sm", activeTool === 'smart' ? "w-2 h-2 mt-1 rounded-sm border border-black/50" : "w-1 h-6 rounded-full")} />
                        </div>
                      )}

                      <div className={cn("absolute inset-y-0 overflow-hidden pointer-events-none", track.showAutomation ? "top-6 bottom-16" : "bottom-1 top-5")} style={{ left: 0, right: 0 }}>
                        <div style={{ position: 'absolute', left: `${-(track.clipStart || 0) * 20 * zoom}px`, width: `${(track.fullDuration || track.duration || 40) * 20 * zoom}px`, height: '100%' }}>
                          <TrackWaveformSVG track={track} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Playhead */}
            <div ref={playheadRef} className="absolute top-0 bottom-0 w-[2px] -ml-[1px] bg-primary z-50 pointer-events-none group shadow-[0_0_10px_rgba(var(--primary),0.8)]" style={{ left: `${currentTimeRef.current * 20 * zoom}px` }}>
              <div className="absolute top-0 -translate-x-1/2 w-4 h-4 bg-primary rounded-b flex items-center justify-center cursor-ew-resize pointer-events-auto hover:bg-primary/90 shadow-md"><div className="w-0.5 h-2 bg-background/80 rounded-full" /></div>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Mixer / Status Bar */}
      <div className="min-h-[2.5rem] py-1.5 mx-2 sm:mx-3 mb-2 sm:mb-3 mt-2 sm:mt-3 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between px-3 sm:px-4 text-xs text-muted-foreground shrink-0 overflow-hidden gap-2 relative z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => setShowMixerPanel(!showMixerPanel)} className={cn("h-6 text-xs gap-1.5", showMixerPanel && "bg-secondary text-foreground")}>
            <SlidersHorizontal className="w-3 h-3" /> Mixer
          </Button>
          <div className="hidden md:flex items-center gap-2 border-l border-r border-border/50 px-3 mx-1" title="Master Output Level (Scales all track volumes)">
            <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Master</span>
            <Volume2 className="w-3 h-3 text-muted-foreground" />
            <Slider 
              value={[masterVolume]} 
              max={100} 
              step={1} 
              onValueChange={(val) => setMasterVolume(val[0])}
              className="w-20"
            />
            <span className="w-7 text-right font-mono text-[10px]">{masterVolume}%</span>
          </div>
          <span className="flex items-center gap-1.5 shrink-0"><Layers className="w-3.5 h-3.5" /> {tracks.length} Tracks</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="flex items-center gap-1.5">
            <Circle className={cn("w-2.5 h-2.5", isRecording ? "fill-red-500 text-red-500 animate-pulse" : isPlaying ? "fill-primary text-primary" : "fill-foreground text-foreground")} />
            {isRecording ? "Recording" : isPlaying ? "Playing" : "Stopped"}
          </span>
        </div>
      </div>

      <MixerPanel 
        show={showMixerPanel} 
        onClose={() => setShowMixerPanel(false)} 
        tracks={tracks} 
        masterVolume={masterVolume} 
        setMasterVolume={setMasterVolume} 
        updateVolume={updateVolume} 
        toggleMute={toggleMute} 
        toggleSolo={toggleSolo} 
        updateTrack={(trackId, data) => setTracks(prev => prev.map(t => t.id === trackId ? { ...t, ...data } : t))}
      />

      <HardwarePreferencesDialog 
        open={showPreferencesDialog} 
        onOpenChange={setShowPreferencesDialog} 
        hardware={hardware} 
        audioSettings={audioSettings}
        setAudioSettings={setAudioSettings}
        onRefreshMidi={async () => {
          setHardware(prev => ({...prev, refreshingMidi: true}));
          try {
            if (navigator.requestMIDIAccess) {
              const access = await navigator.requestMIDIAccess({ sysex: false });
              setHardware(prev => ({...prev, midi: access.inputs.size > 0, refreshingMidi: false}));
            } else {
              setHardware(prev => ({...prev, refreshingMidi: false}));
            }
          } catch (e) {
            setHardware(prev => ({...prev, refreshingMidi: false}));
          }
        }}
      />

      <KeyboardShortcutsDialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog} />

      <StudioExtras 
        showQuickMemo={showQuickMemo} setShowQuickMemo={setShowQuickMemo}
        showImportDialog={showImportDialog} setShowImportDialog={setShowImportDialog}
        handleFileChange={(e) => {
          handleFileChange(e);
          setShowImportDialog(false);
        }}
        showMilestones={showMilestones} setShowMilestones={setShowMilestones}
        projectId={roomId || "local_studio"}
      />

      <StudioDialogs
        creatingTrack={creatingTrack} setCreatingTrack={setCreatingTrack}
        newTrackName={newTrackName} setNewTrackName={setNewTrackName}
        newTrackType={newTrackType} setNewTrackType={setNewTrackType}
        handleCreateTrackConfirm={handleCreateTrackConfirm}
        renamingTrack={renamingTrack} setRenamingTrack={setRenamingTrack}
        setTracksWithHistory={setTracksWithHistory}
        pendingTimeSignature={pendingTimeSignature} setPendingTimeSignature={setPendingTimeSignature} setTimeSignature={setTimeSignature}
        pendingSongKey={pendingSongKey} setPendingSongKey={setPendingSongKey} setSongKey={setSongKey}
      />

      <ExportPurchaseDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        format={exportFormat}
        tracks={tracks}
        projectName={projectName}
      />

      {/* Precision editing tooltip — DOM-direct, no re-renders */}
      <div
        ref={editTooltipRef}
        className="fixed z-[200] pointer-events-none bg-primary text-primary-foreground text-xs font-mono px-2 py-1 rounded-md shadow-lg opacity-0 transition-opacity duration-150"
        style={{ top: 0, left: 0 }}
      />

      {/* Mobile bottom bar - Studio only */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex items-center justify-center border-t border-border bg-card/90 backdrop-blur-md py-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          onClick={() => { handleSave(); navigate('/'); }}
          className="flex items-center gap-2 px-6 py-2 rounded-full bg-secondary text-muted-foreground hover:text-foreground text-sm font-medium transition-colors min-h-[44px]"
        >
          <ChevronLeft className="w-4 h-4" /> Exit Studio
        </button>
      </div>
    </div>
  );
}