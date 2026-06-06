import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, Square, Circle, Mic, Plus, Settings2, Volume2, 
  Scissors, Copy, Save, Download, FastForward, Rewind, MoreVertical,
  Maximize2, Pause, Layers, Headphones, Speaker, Keyboard, Upload,
  Cpu, Activity, Trash2, MousePointer2, MoveHorizontal, Grid, Shuffle,
  Crosshair, PenTool, Link2, Unlock, TrendingUp, Option, Undo, Redo, SlidersHorizontal, Wand2,
  Image as ImageIcon, Users, Video, VideoOff, Radio, Loader2, GripVertical
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import WaveEditor from '@/components/studio/WaveEditor';
import BounceDialog from '@/components/studio/BounceDialog';
import { sounds } from '@/hooks/use-sound';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradeModal from '@/components/billing/UpgradeModal';
import { Link, useNavigate } from 'react-router-dom';
import { separateStems, generateMelody, renderMixToWav, renderMixToMp3 } from '@/lib/audioProcessing';
import { useStudioPresence } from '@/hooks/useStudioPresence';
import LivePresenceBar from '@/components/studio/LivePresenceBar';
import HardwarePreferencesDialog from '@/components/studio/HardwarePreferencesDialog';
import MixerPanel from '@/components/studio/MixerPanel';

// Fake waveform generator - High-resolution for precision editing
const generateWaveform = (length = 2000) => {
  return Array.from({ length }, (_, i) => {
    const envelope = Math.sin(i * Math.PI / length) * 0.8 + 0.2;
    const noise = Math.random() * 0.8 + 0.1;
    const bursts = Math.sin(i * 0.1) * Math.cos(i * 0.05);
    return Math.min(1, Math.max(0.02, Math.abs(bursts * noise * envelope) * 2));
  });
};

const waveformFills = {
  "bg-primary": "fill-primary",
  "bg-pink-500": "fill-pink-500",
  "bg-accent": "fill-accent",
  "bg-yellow-500": "fill-yellow-500",
  "bg-purple-500": "fill-purple-500",
  "bg-green-500": "fill-green-500"
};

export default function Studio() {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const currentTimeRef = useRef(0);
  const timeDisplayRef = useRef(null);
  const recordingIndicatorRefs = useRef({});
  const [zoom, setZoom] = useState(1);
  const playheadRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioElementsRef = useRef({});
  const fileInputRef = useRef(null);
  const [editingTrack, setEditingTrack] = useState(null);
  const [renamingTrack, setRenamingTrack] = useState(null);
  const [newTrackName, setNewTrackName] = useState("");
  const [selectedTrackIds, setSelectedTrackIds] = useState([1]);

  const [maxTracks, setMaxTracks] = useState(2); // Free tier default
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  
  const [editMode, setEditMode] = useState('grid'); // slip, grid, shuffle
  const [activeTool, setActiveTool] = useState('smart'); // smart, trim, grab, fade
  const [gridSize, setGridSize] = useState(1);

  const [masterVolume, setMasterVolume] = useState(100);
  const [showMixerPanel, setShowMixerPanel] = useState(false);

  // Session musical settings shown in the transport (BPM, time signature, key)
  const [bpm, setBpm] = useState(120);
  const [bpmInput, setBpmInput] = useState('120');
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [songKey, setSongKey] = useState('C Maj');
  const [audioSettings, setAudioSettings] = useState({ sampleRate: "44.1 kHz", bitDepth: "24-bit" });
  
  const [bounceOpen, setBounceOpen] = useState(false);
  const [bounceRedirect, setBounceRedirect] = useState(null);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
  
  const [hardware, setHardware] = useState({
    mic: false,
    interface: false,
    output: false,
    midi: false
  });
  const [jamRoomActive, setJamRoomActive] = useState(false);
  const [jamVideoActive, setJamVideoActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(null); // 'separate' | 'generate' | null

  const { hasAccess, isPro, isLoading: isLoadingSub } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Real-time collaborator presence
  const { peers: livePeers, setActivity } = useStudioPresence('studio-main');
  
  const [tracks, setTracks] = useState(() => {
    try {
      const saved = localStorage.getItem('nalistudio_project_autosave');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load project autosave", e);
    }
    return [
      { id: 1, name: "Vocals Lead", color: "bg-green-500", volume: 75, pan: 50, muted: false, solo: false, armed: false, waveform: generateWaveform(2000), startTime: 0, duration: 40, audioUrl: "https://actions.google.com/sounds/v1/water/rain_on_roof.ogg", locked: false, grouped: false, showAutomation: false, elasticAudio: false, fadeIn: 0, fadeOut: 0 },
      { id: 2, name: "Beat / Instrumental", color: "bg-green-500", volume: 75, pan: 50, muted: false, solo: false, armed: false, waveform: generateWaveform(2000), startTime: 0, duration: 40, audioUrl: "https://actions.google.com/sounds/v1/water/rain_on_roof.ogg", locked: false, grouped: false, showAutomation: false, elasticAudio: false, fadeIn: 0, fadeOut: 0 },
    ];
  });

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
    if (historyRef.current.length === 0) {
      historyRef.current = [tracks];
      historyIndexRef.current = 0;
      setHistoryIndex(0);
    }
  }, []);

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

  const undo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      setHistoryIndex(historyIndexRef.current);
      setTracks(historyRef.current[historyIndexRef.current]);
    }
  };

  const redo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      setHistoryIndex(historyIndexRef.current);
      setTracks(historyRef.current[historyIndexRef.current]);
    }
  };

  const setTracksWithHistory = (updater) => {
    setTracks(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pushToHistory(next);
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
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = formatTime(newTime);
      }
      
      if (playheadRef.current) {
        playheadRef.current.style.left = `${newTime * 20 * zoom}px`;
      }
      
      if (isRecording && recordingStartTime !== null) {
        Object.values(recordingIndicatorRefs.current).forEach(el => {
          if (el) el.style.width = `${Math.max(0, newTime - recordingStartTime) * 20 * zoom}px`;
        });
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
          audio.currentTime = currentTimeRef.current;
          audio.volume = track.muted ? 0 : ((track.volume / 100) * (masterVolume / 100));
          audio.play().catch(e => console.error("Audio playback error:", e));
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
        
        let realWaveform = generateWaveform(2000);
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const channelData = audioBuffer.getChannelData(0);
          
          // Max efficiency waveform generation using Float32Array and striding
          const numPoints = 2000;
          const blockSize = Math.floor(channelData.length / numPoints);
          const stride = Math.max(1, Math.floor(blockSize / 64)); // Sample max 64 points per block to prevent blocking main thread
          
          const waveform = new Float32Array(numPoints);
          let maxVal = 0;
          
          for (let i = 0; i < numPoints; i++) {
            let start = i * blockSize;
            let sum = 0;
            let samples = 0;
            for (let j = 0; j < blockSize; j += stride) {
              sum += Math.abs(channelData[start + j]);
              samples++;
            }
            const val = sum / samples;
            waveform[i] = val;
            if (val > maxVal) maxVal = val;
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
              duration: recordingStartTime !== null ? Math.max(1, currentTimeRef.current - recordingStartTime) : 10
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
    const wasPlayingOrRecording = isPlaying || isRecording;
    setIsPlaying(false);
    if (isRecording) {
      setIsRecording(false);
      stopRecordingProcess();
    } else {
      sounds.recStop();
    }
    
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.pause();
    });

    if (!wasPlayingOrRecording) {
      updateCurrentTime(0);
      Object.values(audioElementsRef.current).forEach(audio => {
        audio.currentTime = 0;
      });
    }
  };

  // Keyboard shortcuts for Power Users
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        toggleRecord();
      } else if (e.code === 'Enter') {
        e.preventDefault();
        stop();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isRecording, togglePlay, toggleRecord]);

  const toggleMute = (trackId) => {
    sounds.click();
    // Mute and Solo are mutually exclusive — enabling mute clears solo.
    setTracksWithHistory(tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted, solo: !t.muted ? false : t.solo } : t));
  };

  const toggleSolo = (trackId) => {
    sounds.click();
    // Mute and Solo are mutually exclusive — enabling solo clears mute.
    setTracksWithHistory(tracks.map(t => t.id === trackId ? { ...t, solo: !t.solo, muted: !t.solo ? false : t.muted } : t));
  };

  const toggleArm = (trackId) => {
    sounds.click();
    setTracksWithHistory(tracks.map(t => t.id === trackId ? { ...t, armed: !t.armed } : t));
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
    if (audioElementsRef.current[trackId]) {
      audioElementsRef.current[trackId].pause();
      delete audioElementsRef.current[trackId];
    }
    setTracksWithHistory(prev => prev.filter(t => t.id !== trackId));
    setSelectedTrackIds(prev => prev.filter(id => id !== trackId));
    toast.success("Track deleted");
  };

  const duplicateTrack = (track) => {
    if (tracks.length >= maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
      return;
    }
    const nextId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
    setTracksWithHistory(prev => [...prev, { ...track, id: nextId, name: `${track.name} (Copy)` }]);
    toast.success("Track duplicated");
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
          const splitRatio = (curr - clipStart) / clipDuration;
          const splitIndex = Math.floor(t.waveform.length * splitRatio);
          
          const waveformPart1 = t.waveform.slice(0, splitIndex);
          const waveformPart2 = t.waveform.slice(splitIndex);
          
          splitCount++;
          
          newTracksList.push({
            ...t,
            id: nextId++,
            name: `${t.name} (Cut)`,
            waveform: waveformPart2,
            startTime: curr,
            duration: clipEnd - curr
          });
          
          return {
            ...t,
            waveform: waveformPart1,
            duration: curr - clipStart
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
    const colors = ["bg-green-500"];
    setTracksWithHistory([...tracks, {
      id: newId,
      name: `New Track ${newId}`,
      color: colors[newId % colors.length],
      volume: 75,
      pan: 50,
      muted: false,
      solo: false,
      armed: false,
      waveform: [],
      startTime: 0,
      duration: 0
    }]);
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
    toast.info("Separating stems by frequency...");
    try {
      const { vocals, instrumental } = await separateStems(track.audioUrl);
      let nextId = Math.max(...tracks.map(t => t.id)) + 1;
      setTracksWithHistory(prev => [...prev,
        { ...track, id: nextId, name: `${track.name} (Vocals/Highs)`, color: "bg-green-500", audioUrl: vocals.url, waveform: vocals.waveform, duration: vocals.duration, startTime: track.startTime || 0, segments: undefined, effects: undefined },
        { ...track, id: nextId + 1, name: `${track.name} (Instrumental/Lows)`, color: "bg-green-500", audioUrl: instrumental.url, waveform: instrumental.waveform, duration: instrumental.duration, startTime: track.startTime || 0, segments: undefined, effects: undefined }
      ]);
      toast.success("Stems separated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to separate stems.");
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

  const handleSave = () => {
    try {
      localStorage.setItem('nalistudio_project_autosave', JSON.stringify(tracks));
      toast.success("Project saved successfully!");
    } catch (e) {
      toast.error("Failed to save project.");
    }
  };

  const saveTrackEffects = (trackId, updatedTrack) => {
    setTracksWithHistory(tracks.map(t => t.id === trackId ? updatedTrack : t));
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const decodeWaveform = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const numPoints = 2000;
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
      return { waveform: generateWaveform(2000), duration: 40 };
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
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

  if (!isLoadingSub && !hasAccess) {
    return (
      <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] items-center justify-center p-8 bg-background">
        <h2 className="text-2xl font-bold font-heading mb-4">NaliStudio Pro Required</h2>
        <p className="text-muted-foreground mb-6 max-w-md text-center">
          Your free trial has ended. Upgrade to Pro to continue using the Studio and access premium features.
        </p>
        <Button onClick={() => setShowUpgradeModal(true)} size="lg" className="bg-gradient-to-r from-primary to-pink-500 text-white shadow-lg">
           View Plans & Upgrade
        </Button>
        <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} triggerReason="studio" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-16 border-b border-border/50 bg-card/80 backdrop-blur flex items-center justify-between gap-2 px-2 sm:px-4 shrink-0 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-4 shrink-0">
          <div className="font-heading font-black text-base sm:text-xl text-gradient-animate tracking-tight flex items-center gap-2">
            <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span className="hidden xs:inline sm:inline">NaliStudio</span>
            <span className="hidden sm:inline text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest ml-2">Pro</span>
            <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="hidden lg:inline text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider ml-1 border border-green-500/30 cursor-help">Engine v2</span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[240px] text-xs">Engine v2 — NaliStudio's latest audio engine: faster real-time mixing, higher-quality stem separation, and lower-latency recording.</TooltipContent></Tooltip></TooltipProvider>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-1 sm:gap-2 bg-background/50 p-1 sm:p-1.5 rounded-xl border border-border/50 shadow-inner shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={(e) => { updateCurrentTime(0); e.currentTarget.blur(); }} className="hidden sm:flex w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground"><Rewind className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Back to Start</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={(e) => { stop(); e.currentTarget.blur(); }} className="w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground"><Square className="w-5 h-5 fill-current" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Stop <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Enter</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={togglePlay} className={cn("w-12 h-12 rounded-lg transition-all", isPlaying ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>{isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1 fill-current" />}</Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">{isPlaying ? "Pause" : "Play"} <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Space</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleRecord} className={cn("w-12 h-12 rounded-lg transition-all relative overflow-hidden", isRecording ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-400" : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10")}>{isRecording && <span className="absolute inset-0 bg-red-500/20 animate-ping rounded-lg" />}<Circle className={cn("w-5 h-5", isRecording ? "fill-current" : "fill-current")} /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Record <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">R</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={(e) => { updateCurrentTime(Math.min(100, currentTimeRef.current + 5)); e.currentTarget.blur(); }} className="hidden sm:flex w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground"><FastForward className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Fast-forward</TooltipContent></Tooltip>
          </TooltipProvider>
        </div>

        {/* Right Tools - Hardware & Export */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Collaborators */}
          <LivePresenceBar peers={livePeers} />

          {/* Quick Record */}
          <div className="hidden lg:flex items-center gap-1 mr-2 border-r border-border/50 pr-3">
             <Button onClick={() => navigate('/record')} variant="outline" size="sm" className="gap-2 rounded-xl border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-400">
               <Radio className="w-4 h-4 animate-pulse" />
               Quick Record
             </Button>
          </div>

          {/* Jam Room */}
          <div className="hidden lg:flex items-center gap-1 mr-2 border-r border-border/50 pr-3">
             <Button variant={jamRoomActive ? "default" : "outline"} size="sm" onClick={() => setJamRoomActive(!jamRoomActive)} className={cn("gap-2 rounded-xl border-border/50", jamRoomActive && "bg-green-500 hover:bg-green-600 text-white border-transparent")}>
               <Users className="w-4 h-4" />
               {jamRoomActive ? "Jam Room Active" : "Start Jam Room"}
             </Button>
             {jamRoomActive && (
               <Button variant="ghost" size="icon" onClick={() => setJamVideoActive(!jamVideoActive)} className="w-8 h-8 rounded-lg hover:bg-secondary">
                 {jamVideoActive ? <Video className="w-4 h-4 text-green-400" /> : <VideoOff className="w-4 h-4 text-muted-foreground" />}
               </Button>
             )}
          </div>

          {/* Hardware Config */}
          <div className="hidden lg:flex items-center gap-1 mr-2 border-r border-border/50 pr-3">
            <Button variant="ghost" size="sm" title="Hardware Preferences" onClick={() => setShowPreferencesDialog(true)} className="gap-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
              <Settings2 className="w-4 h-4" /> Hardware
            </Button>
          </div>

          <div className="font-mono text-sm sm:text-xl text-primary font-bold bg-[#0a0a0c] px-2 sm:px-4 py-1.5 rounded-lg border border-border w-24 sm:w-36 text-center shadow-inner tracking-tight sm:tracking-normal relative group shrink-0">
            <span ref={timeDisplayRef}>{formatTime(currentTimeRef.current)}</span>
            {isRecording && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </div>


          <div className="hidden md:flex items-center gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept="audio/*,.wav,.wave,.mp3,.mid,.midi,.flac,.ogg,.m4a,.aac,.wma,.aiff,.aif" onChange={handleFileChange} />
            <Button variant="outline" className="gap-2 rounded-xl border-border/50" onClick={handleImportClick}>
              <Upload className="w-4 h-4" /> Import
            </Button>
            <Button variant="outline" className="gap-2 rounded-xl border-border/50" onClick={handleSave}>
              <Save className="w-4 h-4" /> Save
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary">
                  <Download className="w-4 h-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleDownloadMix('wav')} disabled={isDownloading} className="cursor-pointer py-2">
                  {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Download Mix (WAV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadMix('mp3')} disabled={isDownloading} className="cursor-pointer py-2">
                  {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Download Mix (MP3)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setBounceRedirect('explore'); setBounceOpen(true); }} className="cursor-pointer py-2">
                  <Download className="w-4 h-4 mr-2" /> Export & Publish
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setBounceRedirect('cover-art'); setBounceOpen(true); }} className="cursor-pointer py-2">
                  <ImageIcon className="w-4 h-4 mr-2" /> Export to Cover Creator
                </DropdownMenuItem>
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
          </div>
        </div>
      </div>

      {/* Toolbar 2 (Tools) */}
      <div className="h-12 border-b border-border/40 bg-card/40 flex items-center px-4 gap-4 shrink-0 overflow-x-auto custom-scrollbar">
        <Button onClick={addTrack} variant="secondary" size="sm" className="gap-2 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 shrink-0">
          <Plus className="w-4 h-4" /> Add Track
        </Button>
        <Button 
          onClick={() => {
            if (selectedTrackIds.length === 1) {
              const track = tracks.find(t => t.id === selectedTrackIds[0]);
              if (track) setEditingTrack(track);
            } else {
              toast.error("Please select exactly one track to open the Wave Editor");
            }
          }} 
          variant="secondary" 
          size="sm" 
          className="gap-2 h-8 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" /> Wave Editor
        </Button>
        <Button 
          onClick={handleSeparateStems}
          disabled={isProcessing}
          variant="secondary" 
          size="sm" 
          className="gap-2 h-8 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 shrink-0 disabled:opacity-50"
        >
          {isProcessing === 'separate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Split Stems
        </Button>
        <Button
          onClick={handleGenerateMelody}
          disabled={isProcessing}
          variant="secondary" 
          size="sm" 
          className="gap-2 h-8 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 shrink-0 disabled:opacity-50"
        >
          {isProcessing === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Generate Melody
        </Button>

        <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
        
        {/* Undo / Redo */}
        <div className="flex items-center gap-1 shrink-0 bg-secondary/30 p-1 rounded-lg">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex <= 0} className="w-7 h-7 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"><Undo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Undo <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+Z</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={redo} disabled={historyIndex >= historyRef.current.length - 1} className="w-7 h-7 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"><Redo className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Redo <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+Y</kbd></TooltipContent></Tooltip>
          </TooltipProvider>
        </div>

        {/* BPM / Time Signature / Key display */}
        <div className="flex items-stretch gap-px bg-background/50 rounded-lg border border-border/50 shadow-inner overflow-hidden shrink-0">
          <label className="flex flex-col items-center justify-center px-2 py-0.5 hover:bg-secondary/40 transition-colors cursor-text" title="Tempo (beats per minute)">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">BPM</span>
            <input
              type="text"
              inputMode="numeric"
              value={bpmInput}
              onChange={(e) => setBpmInput(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={() => { const c = Math.max(20, Math.min(300, Number(bpmInput) || 120)); setBpm(c); setBpmInput(String(c)); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="w-10 bg-transparent text-center font-mono text-xs font-bold text-foreground outline-none border-none p-0 leading-tight"
            />
          </label>
          <div className="flex flex-col items-center justify-center px-2 py-0.5 border-l border-border/60" title="Time signature">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">Sig</span>
            <select
              value={timeSignature}
              onChange={(e) => setTimeSignature(e.target.value)}
              className="bg-transparent text-center font-mono text-xs font-bold text-foreground outline-none border-none p-0 leading-tight cursor-pointer appearance-none"
            >
              <option value="4/4">4/4</option>
              <option value="3/4">3/4</option>
              <option value="6/8">6/8</option>
              <option value="5/4">5/4</option>
              <option value="7/8">7/8</option>
            </select>
          </div>
          <div className="flex flex-col items-center justify-center px-2 py-0.5 border-l border-border/60" title="Project key">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">Key</span>
            <select
              value={songKey}
              onChange={(e) => setSongKey(e.target.value)}
              className="bg-transparent text-center font-mono text-xs font-bold text-foreground outline-none border-none p-0 leading-tight cursor-pointer appearance-none"
            >
              {["C Maj","G Maj","D Maj","A Maj","E Maj","F Maj","Bb Maj","A min","E min","B min","D min","G min","C min"].map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />

        {/* Edit Modes */}
        <div className="flex items-center gap-1 shrink-0 bg-secondary/30 p-1 rounded-lg">
          {['shuffle', 'slip', 'grid'].map((mode) => (
            <Button
              key={mode}
              variant="ghost"
              size="sm"
              onClick={() => setEditMode(mode)}
              aria-pressed={editMode === mode}
              title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} edit mode`}
              className={cn(
                "px-2.5 py-1 h-7 text-xs rounded-md capitalize transition-all",
                editMode === mode
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm ring-1 ring-primary/50 hover:bg-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              {mode}
            </Button>
          ))}
        </div>

        {/* Tools */}
        <div className="flex items-center gap-1 shrink-0 bg-secondary/30 p-1 rounded-lg">
          <Button variant="ghost" size="icon" onClick={() => setActiveTool('trim')} className={cn("w-7 h-7 rounded text-muted-foreground hover:text-foreground", activeTool === 'trim' && "bg-primary/20 text-primary")} title="Trim Tool"><MoveHorizontal className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setActiveTool('cut')} className={cn("w-7 h-7 rounded text-muted-foreground hover:text-foreground", activeTool === 'cut' && "bg-primary/20 text-primary")} title="Cut Tool"><Scissors className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setActiveTool('grab')} className={cn("w-7 h-7 rounded text-muted-foreground hover:text-foreground", activeTool === 'grab' && "bg-primary/20 text-primary")} title="Grabber Tool"><MousePointer2 className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setActiveTool('fade')} className={cn("w-7 h-7 rounded text-muted-foreground hover:text-foreground", activeTool === 'fade' && "bg-primary/20 text-primary")} title="Fade Tool"><Crosshair className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setActiveTool('smart')} className={cn("w-7 h-7 rounded text-muted-foreground border border-transparent hover:text-foreground", activeTool === 'smart' && "border-primary text-primary bg-primary/10")} title="Smart Tool">
             <div className="flex flex-col gap-0.5 items-center">
               <div className="flex gap-[1px]"><MoveHorizontal className="w-2.5 h-2.5"/><MousePointer2 className="w-2.5 h-2.5"/></div>
             </div>
          </Button>
        </div>

        <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => {
            const allLocked = selectedTrackIds.every(id => tracks.find(t => t.id === id)?.locked);
            selectedTrackIds.forEach(id => toggleTrackProperty(id, 'locked'));
          }} disabled={selectedTrackIds.length === 0} className="w-8 h-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50" title="Lock/Unlock Clip">{tracks.find(t => t.id === selectedTrackIds[0])?.locked ? <Unlock className="w-4 h-4"/> : <Link2 className="w-4 h-4"/>}</Button>
          <Button variant="ghost" size="icon" onClick={splitSelectedTracks} disabled={selectedTrackIds.length === 0} className="w-8 h-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50" title="Separate Clip"><Scissors className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={duplicateSelectedTracks} disabled={selectedTrackIds.length === 0} className="w-8 h-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50" title="Duplicate Clip"><Copy className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={deleteSelectedTracks} disabled={selectedTrackIds.length === 0} className="w-8 h-8 rounded-md text-muted-foreground hover:text-red-400 disabled:opacity-50" title="Delete"><Trash2 className="w-4 h-4" /></Button>
        </div>
        
        <div className="flex-1" />
        <div className="flex items-center gap-3 ml-auto text-sm text-muted-foreground shrink-0 pl-4">
          <Maximize2 className="w-4 h-4" /> Zoom
          <Slider 
            value={[zoom]} 
            min={0.5} 
            max={10} 
            step={0.1}
            onValueChange={(v) => setZoom(v[0])}
            className="w-24"
          />
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden bg-[#0a0a0c] relative">
        {/* Jam Room Floating Overlay */}
        <AnimatePresence>
          {jamRoomActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-4 right-4 z-50 flex flex-col items-end gap-2"
            >
              <div className="w-56 bg-card/90 backdrop-blur border border-border rounded-xl shadow-xl overflow-hidden p-4 flex flex-col items-center text-center">
                <div className="relative mb-2">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,1)]" />
                </div>
                <p className="text-xs font-semibold text-foreground">Jam Room is live</p>
                <p className="text-[10px] text-muted-foreground mt-1">Share the room link from Messages to invite collaborators. They'll appear here when they join.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Track Headers (Left Sidebar) */}
        <div className="w-44 sm:w-72 border-r border-border/50 bg-card/60 flex flex-col overflow-y-auto z-10 custom-scrollbar shrink-0 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]">
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
                          className={cn(
                            "border-b border-border/40 p-3 flex flex-col justify-between transition-all cursor-pointer border-l-4",
                            track.showAutomation ? "h-44" : "h-28",
                            track.muted ? "bg-card/30 opacity-70" : "bg-card/80 hover:bg-secondary/40",
                            selectedTrackIds.includes(track.id) ? "border-l-primary bg-primary/20 shadow-[inset_0_0_30px_hsl(var(--primary)/0.15)]" : "border-l-transparent",
                            tracks.some(t => t.solo) && !track.solo && "opacity-40 grayscale",
                            dragSnapshot.isDragging && "shadow-xl ring-1 ring-primary/40 bg-secondary/60"
                          )}
                        >
                <div className="flex items-start justify-between">
                  <div className="flex items-center min-w-0 mr-2">
                    <span
                      {...dragProvided.dragHandleProps}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 -ml-1 mr-1 p-0.5 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                      title="Drag to reorder track"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 font-medium text-sm min-w-0">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", track.color)} />
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="line-clamp-2 text-xs font-semibold cursor-help break-words whitespace-normal" title={track.name}>{track.name}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px] break-words">{track.name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <select 
                      className="bg-transparent border-none text-[9px] text-muted-foreground focus:ring-0 cursor-pointer hover:text-foreground p-0 m-0 mt-0.5 outline-none w-max"
                      title="Track Input Routing"
                      onClick={(e) => e.stopPropagation()}
                      defaultValue={(track.name || "").toLowerCase().includes("beat") || (track.name || "").toLowerCase().includes("instrumental") ? "In: None" : "In: Default Mic"}
                    >
                      <option>In: Default Mic</option>
                      <option>In: Audio Interface</option>
                      <option>In: MIDI Keyboard</option>
                      <option>In: None</option>
                    </select>
                  </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setActivity(`Editing ${track.name}`); setEditingTrack(track); }} className="w-6 h-6 text-muted-foreground hover:text-accent" title="Wave Editor"><SlidersHorizontal className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleTrackProperty(track.id, 'elasticAudio') }} className={cn("hidden sm:flex w-6 h-6 text-muted-foreground hover:text-foreground", track.elasticAudio && "text-blue-400")} title="Elastic Audio"><Activity className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleTrackProperty(track.id, 'showAutomation') }} className={cn("hidden sm:flex w-6 h-6 text-muted-foreground hover:text-foreground", track.showAutomation && "text-primary")} title="Show Automation"><TrendingUp className="w-3.5 h-3.5" /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="w-6 h-6 text-muted-foreground hover:text-foreground" title="Track Options"><Settings2 className="w-3.5 h-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onSelect={(e) => {
                          e.preventDefault();
                          setRenamingTrack(track);
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
                  <button 
                    onClick={() => toggleMute(track.id)}
                    className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all border", track.muted ? "bg-red-500 text-white border-red-500" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground")}
                  >
                    M
                  </button>
                  <button 
                    onClick={() => toggleSolo(track.id)}
                    className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all border", track.solo ? "bg-yellow-500 text-white border-yellow-500" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground")}
                  >
                    S
                  </button>
                  <button 
                    onClick={() => toggleArm(track.id)}
                    className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center justify-center", track.armed ? "bg-red-500 text-white" : "bg-secondary text-muted-foreground hover:bg-red-500/20 hover:text-red-400")}
                  >
                    <Circle className="w-3 h-3 fill-current" />
                  </button>
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
        <div className="flex-1 relative overflow-auto custom-scrollbar flex flex-col bg-[#0f0f13]">
          {/* Timeline Header */}
          <div className="h-8 border-b border-border/30 bg-card/40 sticky top-0 z-20 flex items-end px-0 overflow-hidden relative">
            {/* Timeline markers */}
            <div className="h-full relative cursor-pointer select-none" style={{ width: `${2000 * zoom}px`, minWidth: `${2000 * zoom}px` }}
              onPointerDown={(e) => {
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
              {Array.from({ length: 200 }).map((_, i) => {
                const seconds = i * 5; // Every 5 seconds
                const position = seconds * 20 * zoom;
                return (
                  <div key={i} className="absolute bottom-0 text-[10px] text-muted-foreground/50 border-l border-border/40 pl-1 h-3 -ml-[1px]" style={{ left: `${position}px` }}>
                    {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
                  </div>
                );
              })}
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
            {/* Playhead */}
            <div 
              ref={playheadRef}
              className="absolute top-0 bottom-0 w-[2px] -ml-[1px] bg-primary z-30 pointer-events-none group shadow-[0_0_10px_rgba(var(--primary),0.8)]"
              style={{ left: `${currentTimeRef.current * 20 * zoom}px` }}
            >
              <div className="absolute top-0 -translate-x-1/2 w-4 h-4 bg-primary rounded-b flex items-center justify-center cursor-ew-resize pointer-events-auto hover:bg-primary/90 shadow-md">
                <div className="w-0.5 h-2 bg-background/80 rounded-full" />
              </div>
            </div>

            {/* Waveform Rows */}
            <div className="flex flex-col">
              {tracks.map((track) => (
                <div 
                  key={track.id} 
                  onClick={(e) => handleTrackClick(e, track.id)}
                  onDoubleClick={() => setEditingTrack(track)}
                  className={cn(
                    "border-b border-border/20 relative group transition-all", 
                    track.showAutomation ? "h-44" : "h-28",
                    track.muted ? "opacity-30" : "",
                    selectedTrackIds.includes(track.id) ? "bg-primary/15 shadow-[inset_0_0_30px_hsl(var(--primary)/0.1)]" : "",
                    tracks.some(t => t.solo) && !track.solo && "opacity-40 grayscale"
                  )}
                >
                  {/* Grid lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px)]" style={{ backgroundSize: `${100 * zoom}px 100%` }} />
                  
                  {/* Automation Lane Background */}
                  {track.showAutomation && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 border-t border-white/5 bg-black/40 flex items-center justify-center">
                       <span className="text-[10px] text-muted-foreground/50">Open the Wave Editor to draw volume & pan automation</span>
                    </div>
                  )}

                  {/* Armed / Recording Indicator */}
                  {track.armed && (
                    <div 
                      ref={el => { recordingIndicatorRefs.current[track.id] = el; }}
                      className={cn(
                        "absolute top-0 bottom-0 z-20 pointer-events-none transition-all",
                        isRecording ? "border-l-2 border-red-500 bg-red-500/10" : "w-[2px] bg-red-500/50"
                      )}
                      style={{ 
                        left: `${(isRecording && recordingStartTime !== null ? recordingStartTime : currentTimeRef.current) * 20 * zoom}px`,
                        width: isRecording && recordingStartTime !== null ? `${Math.max(0, currentTimeRef.current - recordingStartTime) * 20 * zoom}px` : '2px'
                      }}
                    >
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
                        <span>Empty — click the Wave Editor button, double-click this row, or record to fill this track</span>
                      </div>
                    </div>
                  )}

                  {/* Audio Region (Clip) */}
                  {track.waveform && track.waveform.length > 0 && (
                    <div 
                      onDoubleClick={() => setEditingTrack(track)}
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
                           const target = e.currentTarget;
                           const rect = target.getBoundingClientRect();
                           const clickX = e.clientX - rect.left;
                           const clickRatio = clickX / rect.width;
                           
                           const splitDuration = track.duration * clickRatio;
                           const splitTime = track.startTime + splitDuration;
                           
                           let nextId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
                           const splitIndex = Math.floor(track.waveform.length * clickRatio);
                           
                           const trackPart1 = {
                             ...track,
                             duration: splitDuration,
                             waveform: track.waveform.slice(0, splitIndex)
                           };
                           
                           const trackPart2 = {
                             ...track,
                             id: nextId,
                             name: `${track.name} (Cut)`,
                             startTime: splitTime,
                             duration: track.duration - splitDuration,
                             waveform: track.waveform.slice(splitIndex)
                           };
                           
                           setTracksWithHistory(prev => {
                             const idx = prev.findIndex(t => t.id === track.id);
                             const newTracks = [...prev];
                             newTracks.splice(idx, 1, trackPart1, trackPart2);
                             return newTracks;
                           });
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
                          
                          const handleMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaTime = deltaX / (20 * zoom);
                            let newStartTime = Math.max(0, initialStartTime + deltaTime);
                            if (editMode === 'grid') {
                               newStartTime = Math.round(newStartTime / gridSize) * gridSize;
                            }
                            
                            target.style.left = `${newStartTime * 20 * zoom}px`;
                            target.dataset.newStartTime = newStartTime;
                          };
                          
                          const handleUp = (upEvent) => {
                            target.releasePointerCapture(upEvent.pointerId);
                            target.removeEventListener('pointermove', handleMove);
                            target.removeEventListener('pointerup', handleUp);
                            
                            const newStartTimeStr = target.dataset.newStartTime;
                            if (newStartTimeStr !== undefined) {
                              const newStartTime = parseFloat(newStartTimeStr);
                              setTracksWithHistory(prev => prev.map(t => 
                                t.id === track.id ? { ...t, startTime: newStartTime } : t
                              ));
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
                        className={cn("absolute left-0 w-3 z-20 group/handle flex justify-center items-center bg-black/20", 
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
                          const initialWaveform = [...track.waveform];
                          
                          target.setPointerCapture(e.pointerId);
                          
                          const handleMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaTime = deltaX / (20 * zoom);
                            
                            if (deltaTime < initialDuration - 1) { 
                               const trimAmount = Math.max(0, deltaTime); 
                               const splitRatio = trimAmount / initialDuration;
                               const splitIndex = Math.floor(initialWaveform.length * splitRatio);
                               
                               setTracks(prev => prev.map(t => 
                                t.id === track.id ? { 
                                  ...t, 
                                  startTime: initialStartTime + trimAmount,
                                  duration: initialDuration - trimAmount,
                                  waveform: initialWaveform.slice(splitIndex)
                                } : t
                              ));
                            }
                          };
                          
                          const handleUp = (upEvent) => {
                            target.releasePointerCapture(upEvent.pointerId);
                            target.removeEventListener('pointermove', handleMove);
                            target.removeEventListener('pointerup', handleUp);
                            pushToHistory(tracksRef.current);
                          };
                          
                          target.addEventListener('pointermove', handleMove);
                          target.addEventListener('pointerup', handleUp);
                        }}
                      >
                        <div className="w-[2px] h-4 bg-white/50 group-hover/handle:bg-white rounded-full" />
                      </div>

                      {/* Right Trim Handle */}
                      <div 
                        className={cn("absolute right-0 w-3 z-20 group/handle flex justify-center items-center bg-black/20", 
                          (activeTool === 'trim' || activeTool === 'smart') ? "cursor-col-resize hover:bg-white/40" : "pointer-events-none opacity-0",
                          activeTool === 'smart' ? "top-[50%] bottom-0" : "top-0 bottom-0"
                        )}
                        onPointerDown={(e) => {
                          if (activeTool !== 'trim' && activeTool !== 'smart') return;
                          e.stopPropagation();
                          const target = e.currentTarget;
                          const startX = e.clientX;
                          const initialDuration = track.duration !== undefined ? track.duration : 40;
                          const initialWaveform = [...track.waveform];
                          
                          target.setPointerCapture(e.pointerId);
                          
                          const handleMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaTime = deltaX / (20 * zoom);
                            
                            if (-deltaTime < initialDuration - 1) {
                               const trimAmount = Math.max(0, -deltaTime); 
                               const keepRatio = (initialDuration - trimAmount) / initialDuration;
                               const keepIndex = Math.floor(initialWaveform.length * keepRatio);
                               
                               setTracks(prev => prev.map(t => 
                                t.id === track.id ? { 
                                  ...t, 
                                  duration: initialDuration - trimAmount,
                                  waveform: initialWaveform.slice(0, keepIndex)
                                } : t
                              ));
                            }
                          };
                          
                          const handleUp = (upEvent) => {
                            target.releasePointerCapture(upEvent.pointerId);
                            target.removeEventListener('pointermove', handleMove);
                            target.removeEventListener('pointerup', handleUp);
                            pushToHistory(tracksRef.current);
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

                      <div 
                        className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none"
                        style={{ width: `${(track.fadeOut || 0) * 100}%` }}
                      />
                      {(activeTool === 'fade' || activeTool === 'smart') && (
                        <div className={cn("absolute w-6 hover:bg-white/10 flex justify-center group z-20 pointer-events-auto",
                            activeTool === 'smart' ? "top-0 bottom-[50%] items-start cursor-crosshair" : "top-0 bottom-0 items-center cursor-ew-resize"
                          )}
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
                                setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, fadeOut: parseFloat(newFadeStr) } : t));
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

                      <div className={cn("absolute inset-x-0 overflow-hidden pointer-events-none", track.showAutomation ? "top-6 bottom-16" : "bottom-1 top-5")}>
                        {(() => {
                          const wf = track.waveform;
                          const wLen = wf.length - 1 || 1;
                          const gradId = `studio-wf-grad-${track.id}`;
                          const rmsId = `studio-wf-rms-${track.id}`;
                          const glowId = `studio-wf-glow-${track.id}`;

                          let peakPath = `M 0,50 `;
                          for (let i = 0; i <= wLen; i++) peakPath += `L ${(i/wLen)*1000},${50 - Math.max(0.02, wf[i])*48} `;
                          for (let i = wLen; i >= 0; i--) peakPath += `L ${(i/wLen)*1000},${50 + Math.max(0.02, wf[i])*48} `;
                          peakPath += 'Z';

                          let rmsPath = `M 0,50 `;
                          for (let i = 0; i <= wLen; i++) rmsPath += `L ${(i/wLen)*1000},${50 - Math.max(0.015, wf[i])*48*0.62} `;
                          for (let i = wLen; i >= 0; i--) rmsPath += `L ${(i/wLen)*1000},${50 + Math.max(0.015, wf[i])*48*0.62} `;
                          rmsPath += 'Z';

                          let topLine = `M 0,${50 - Math.max(0.02, wf[0])*48} `;
                          for (let i = 1; i <= wLen; i++) topLine += `L ${(i/wLen)*1000},${50 - Math.max(0.02, wf[i])*48} `;
                          let botLine = `M 0,${50 + Math.max(0.02, wf[0])*48} `;
                          for (let i = 1; i <= wLen; i++) botLine += `L ${(i/wLen)*1000},${50 + Math.max(0.02, wf[i])*48} `;

                          const baseFill = "fill-green-500";

                          return (
                            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
                              <defs>
                                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.55" /><stop offset="50%" stopColor="currentColor" stopOpacity="0.28" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.55" /></linearGradient>
                                <linearGradient id={rmsId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="1" /><stop offset="50%" stopColor="currentColor" stopOpacity="0.85" /><stop offset="100%" stopColor="currentColor" stopOpacity="1" /></linearGradient>
                                <filter id={glowId} x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="0.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                              </defs>
                              <g className={baseFill}>
                                <path d={peakPath} fill={`url(#${gradId})`} />
                                <path d={rmsPath} fill={`url(#${rmsId})`} filter={`url(#${glowId})`} />
                                <path d={topLine} fill="none" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.95" vectorEffect="non-scaling-stroke" />
                                <path d={botLine} fill="none" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.95" vectorEffect="non-scaling-stroke" />
                              </g>
                              <line x1="0" y1="50" x2="1000" y2="50" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                            </svg>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Mixer / Status Bar */}
      <div className="h-10 border-t border-border/50 bg-card/80 flex items-center justify-between px-3 sm:px-4 text-xs text-muted-foreground shrink-0 overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => setShowMixerPanel(!showMixerPanel)} className={cn("h-6 text-xs gap-1.5", showMixerPanel && "bg-secondary text-foreground")}>
            <SlidersHorizontal className="w-3 h-3" /> Mixer
          </Button>
          <div className="hidden md:flex items-center gap-2 border-l border-r border-border/50 px-3 mx-1">
            <Volume2 className="w-3 h-3 text-muted-foreground" title="Master Volume" />
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button title="Change Audio Quality Settings" className="text-primary font-medium shrink-0 hover:underline outline-none cursor-pointer whitespace-nowrap">
                <span className="inline">Quality: {audioSettings.sampleRate} / {audioSettings.bitDepth}</span>
                <span className="hidden sm:inline"> • Opus Codec</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-card border-border">
              <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-muted-foreground">Audio Quality</div>
              {[
                { sr: "44.1 kHz", bd: "16-bit" },
                { sr: "44.1 kHz", bd: "24-bit" },
                { sr: "48 kHz", bd: "24-bit" },
                { sr: "88.2 kHz", bd: "24-bit" },
                { sr: "96 kHz", bd: "24-bit" },
                { sr: "96 kHz", bd: "32-bit float" },
                { sr: "192 kHz", bd: "32-bit float" }
              ].map((setting, i) => (
                <DropdownMenuItem 
                  key={i}
                  onClick={() => setAudioSettings({ sampleRate: setting.sr, bitDepth: setting.bd })}
                  className="cursor-pointer text-xs"
                >
                  {setting.sr} / {setting.bd}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" /> {tracks.filter(t => t.audioUrl).length} with audio
          </span>
          <span className="flex items-center gap-1.5">
            <Circle className={cn("w-2.5 h-2.5", isRecording ? "fill-red-500 text-red-500 animate-pulse" : isPlaying ? "fill-green-500 text-green-500" : "fill-muted-foreground/40 text-muted-foreground/40")} />
            {isRecording ? "Recording" : isPlaying ? "Playing" : "Idle"}
          </span>
        </div>
      </div>

      <WaveEditor 
        track={editingTrack} 
        onClose={() => setEditingTrack(null)} 
        onSave={saveTrackEffects}
      />

      <MixerPanel 
        show={showMixerPanel} 
        onClose={() => setShowMixerPanel(false)} 
        tracks={tracks} 
        masterVolume={masterVolume} 
        setMasterVolume={setMasterVolume} 
        updateVolume={updateVolume} 
        toggleMute={toggleMute} 
        toggleSolo={toggleSolo} 
      />

      <HardwarePreferencesDialog 
        open={showPreferencesDialog} 
        onOpenChange={setShowPreferencesDialog} 
        hardware={hardware} 
      />

      <Dialog open={!!renamingTrack} onOpenChange={(open) => !open && setRenamingTrack(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Track</DialogTitle>
          </DialogHeader>
          <Input 
            value={newTrackName} 
            onChange={(e) => setNewTrackName(e.target.value)} 
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (newTrackName.trim()) {
                  setTracksWithHistory(prev => prev.map(t => t.id === renamingTrack.id ? { ...t, name: newTrackName.trim() } : t));
                }
                setRenamingTrack(null);
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingTrack(null)}>Cancel</Button>
            <Button onClick={() => {
              if (newTrackName.trim()) {
                setTracksWithHistory(prev => prev.map(t => t.id === renamingTrack.id ? { ...t, name: newTrackName.trim() } : t));
              }
              setRenamingTrack(null);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}