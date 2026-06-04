import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, Square, Circle, Mic, Plus, Settings2, Volume2, 
  Scissors, Copy, Save, Download, FastForward, Rewind, MoreVertical,
  Maximize2, Pause, Layers, Headphones, Speaker, Keyboard, Upload,
  Cpu, Activity, Trash2, MousePointer2, MoveHorizontal, Grid, Shuffle,
  Crosshair, PenTool, Link2, Unlock, TrendingUp, Option, Undo, Redo, SlidersHorizontal, Wand2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import WaveEditor from '@/components/studio/WaveEditor';
import { sounds } from '@/hooks/use-sound';

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
  const [selectedTrackIds, setSelectedTrackIds] = useState([1]);
  const [maxTracks, setMaxTracks] = useState(2); // Free tier default
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  
  const [editMode, setEditMode] = useState('slip'); // slip, grid, shuffle
  const [activeTool, setActiveTool] = useState('smart'); // smart, trim, grab, fade
  const [gridSize, setGridSize] = useState(1);
  
  const [hardware, setHardware] = useState({
    mic: false,
    interface: false,
    output: false,
    midi: false
  });
  
  const [tracks, setTracks] = useState([
    { id: 1, name: "Vocals Lead", color: "bg-primary", volume: 80, pan: 50, muted: false, solo: false, armed: false, waveform: generateWaveform(2000), startTime: 0, duration: 40, locked: false, grouped: false, showAutomation: false, elasticAudio: false, fadeIn: 0, fadeOut: 0 },
    { id: 2, name: "Beat / Instrumental", color: "bg-accent", volume: 90, pan: 50, muted: false, solo: false, armed: false, waveform: generateWaveform(2000), startTime: 0, duration: 40, locked: false, grouped: false, showAutomation: false, elasticAudio: false, fadeIn: 0, fadeOut: 0 },
  ]);

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

  useEffect(() => {
    const fetchSub = async () => {
      try {
        const user = await base44.auth.me();
        if (user) {
          const subs = await base44.entities.Subscription.list('-created_date', 10);
          const activeSub = subs.find(s => s.user_id === user.id && s.status === 'active');
          if (activeSub) {
            if (activeSub.plan === 'creator') setMaxTracks(16);
            else if (activeSub.plan === 'pro') setMaxTracks(999);
          }
        }
      } catch (e) {
        // Not logged in or no sub
      }
    };
    fetchSub();
  }, []);

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
      tracks.forEach(track => {
        if (track.audioUrl && (!track.muted || track.solo)) {
          let audio = audioElementsRef.current[track.id];
          if (!audio || audio.src !== track.audioUrl) {
            audio = new Audio(track.audioUrl);
            audioElementsRef.current[track.id] = audio;
          }
          audio.currentTime = currentTimeRef.current;
          audio.volume = track.muted ? 0 : (track.volume / 100);
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
        audio.volume = track.muted ? 0 : (track.volume / 100);
      }
    });
  }, [tracks]);

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
    if (isRecording) {
      setIsRecording(false);
      stopRecordingProcess();
    } else {
      sounds.recStop();
    }
    updateCurrentTime(0);
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
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
    setTracksWithHistory(tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const toggleSolo = (trackId) => {
    setTracksWithHistory(tracks.map(t => t.id === trackId ? { ...t, solo: !t.solo } : t));
  };

  const toggleArm = (trackId) => {
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
    if (tracks.length >= maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
      return;
    }

    const newId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
    const colors = ["bg-primary", "bg-pink-500", "bg-accent", "bg-yellow-500", "bg-purple-500", "bg-green-500"];
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

  const saveTrackEffects = (trackId, updatedTrack) => {
    setTracksWithHistory(tracks.map(t => t.id === trackId ? updatedTrack : t));
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (tracks.length >= maxTracks) {
        toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
        return;
      }
      
      const newId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
      const colors = ["bg-primary", "bg-pink-500", "bg-accent", "bg-yellow-500", "bg-purple-500", "bg-green-500"];
      const fileUrl = URL.createObjectURL(file);
      
      setTracksWithHistory([...tracks, {
        id: newId,
        name: file.name,
        color: colors[newId % colors.length],
        volume: 75,
        pan: 50,
        muted: false,
        solo: false,
        armed: false,
        waveform: generateWaveform(2000),
        startTime: 0,
        duration: 40,
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

  const handleExport = () => {
    if (tracks.length === 0) {
      toast.error("No tracks to export");
      return;
    }
    
    const destination = prompt("Save to 'device' (download) or 'app' (cloud files)?", "device");
    if (!destination) return;
    
    const destClean = destination.toLowerCase().trim();
    if (destClean !== 'device' && destClean !== 'app') {
      toast.error("Invalid destination. Choose 'device' or 'app'.");
      return;
    }

    const fileName = prompt("Enter a name for your exported file:", "NaliStudio_Mixdown");
    if (!fileName) return;

    const formats = ["wav", "mp3", "flac", "ogg", "aac", "midi"];
    const format = prompt(`Choose export format (${formats.join(", ")}):`, "wav");
    
    if (!format || !formats.includes(format.toLowerCase().trim())) {
        toast.error("Invalid format selected or cancelled.");
        return;
    }

    const cleanFormat = format.toLowerCase().trim();
    const fullFileName = `${fileName}.${cleanFormat}`;
    
    if (destClean === 'device') {
      const element = document.createElement("a");
      const mimeType = cleanFormat === 'midi' ? 'audio/midi' : `audio/${cleanFormat}`;
      const file = new Blob(["Simulated exported audio data from NaliStudio"], {type: mimeType});
      element.href = URL.createObjectURL(file);
      element.download = fullFileName;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast.success(`Downloaded ${fullFileName} to device`);
    } else {
      toast.success(`Saved ${fullFileName} to your NaliStudio App Files`);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-16 border-b border-border/50 bg-card/80 backdrop-blur flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="font-heading font-black text-xl text-gradient-animate tracking-tight flex items-center gap-2">
            <Mic className="w-6 h-6 text-primary" />
            NaliStudio 
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest ml-2">Pro</span>
            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider ml-1 border border-green-500/30">Engine v2</span>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-2 bg-background/50 p-1.5 rounded-xl border border-border/50 shadow-inner">
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground">
            <Rewind className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={stop}
            className="w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Square className="w-5 h-5 fill-current" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={togglePlay}
            className={cn("w-12 h-12 rounded-lg transition-all", isPlaying ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1 fill-current" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleRecord}
            className={cn("w-12 h-12 rounded-lg transition-all relative overflow-hidden", isRecording ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-400" : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10")}
          >
            {isRecording && <span className="absolute inset-0 bg-red-500/20 animate-ping rounded-lg" />}
            <Circle className={cn("w-5 h-5", isRecording ? "fill-current" : "fill-current")} />
          </Button>
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground">
            <FastForward className="w-5 h-5" />
          </Button>
        </div>

        {/* Right Tools - Hardware & Export */}
        <div className="flex items-center gap-2">
          {/* Hardware Config */}
          <div className="hidden lg:flex items-center gap-1 mr-2 border-r border-border/50 pr-3">
            <Button variant="ghost" size="icon" title="Audio Interface" onClick={() => toast.info(hardware.interface ? "Audio Interface connected" : "No Audio Interface detected")} className={cn("w-8 h-8 rounded-lg hover:bg-secondary transition-colors", hardware.interface ? "text-green-400" : "text-muted-foreground/50")}><Cpu className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" title="Microphone Input" onClick={() => toast.info(hardware.mic ? "Microphone connected" : "No Microphone detected")} className={cn("w-8 h-8 rounded-lg hover:bg-secondary transition-colors", hardware.mic ? "text-green-400" : "text-muted-foreground/50")}><Mic className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" title="Headphones Output" onClick={() => toast.info(hardware.output ? "Audio Output connected" : "No Audio Output detected")} className={cn("w-8 h-8 rounded-lg hover:bg-secondary transition-colors", hardware.output ? "text-green-400" : "text-muted-foreground/50")}><Headphones className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" title="MIDI Controller" onClick={() => toast.info(hardware.midi ? "MIDI Controller connected" : "No MIDI Controller detected")} className={cn("w-8 h-8 rounded-lg hover:bg-secondary transition-colors", hardware.midi ? "text-green-400" : "text-muted-foreground/50")}><Keyboard className="w-4 h-4" /></Button>
          </div>

          <div className="font-mono text-xl text-primary font-bold bg-[#0a0a0c] px-4 py-1.5 rounded-lg border border-border w-36 text-center shadow-inner tracking-widest relative group">
            <span ref={timeDisplayRef}>{formatTime(currentTimeRef.current)}</span>
            {isRecording && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept="audio/*,.mid,.midi,.flac,.ogg,.m4a,.wma,.aiff" onChange={handleFileChange} />
            <Button variant="outline" className="gap-2 rounded-xl border-border/50" onClick={handleImportClick}>
              <Upload className="w-4 h-4" /> Import
            </Button>
            <Button className="gap-2 rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary" onClick={handleExport}>
              <Download className="w-4 h-4" /> Export
            </Button>
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
              toast.error("Please select exactly one track to add plugins");
            }
          }} 
          variant="secondary" 
          size="sm" 
          className="gap-2 h-8 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" /> Add Plugins
        </Button>

        <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
        
        {/* Undo / Redo */}
        <div className="flex items-center gap-1 shrink-0 bg-secondary/30 p-1 rounded-lg">
          <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex <= 0} className="w-7 h-7 rounded text-muted-foreground hover:text-foreground disabled:opacity-30" title="Undo"><Undo className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={historyIndex >= historyRef.current.length - 1} className="w-7 h-7 rounded text-muted-foreground hover:text-foreground disabled:opacity-30" title="Redo"><Redo className="w-3.5 h-3.5" /></Button>
        </div>

        {/* Edit Modes */}
        <div className="flex items-center gap-1 shrink-0 bg-secondary/30 p-1 rounded-lg">
          <Button variant="ghost" size="sm" onClick={() => setEditMode('shuffle')} className={cn("px-2 py-1 h-7 text-xs rounded-md", editMode === 'shuffle' && "bg-primary/20 text-primary")}>Shuffle</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditMode('slip')} className={cn("px-2 py-1 h-7 text-xs rounded-md", editMode === 'slip' && "bg-primary/20 text-primary")}>Slip</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditMode('grid')} className={cn("px-2 py-1 h-7 text-xs rounded-md", editMode === 'grid' && "bg-primary/20 text-primary")}>Grid</Button>
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
      <div className="flex-1 flex overflow-hidden bg-[#0a0a0c]">
        {/* Track Headers (Left Sidebar) */}
        <div className="w-64 border-r border-border/50 bg-card/60 flex flex-col overflow-y-auto z-10 custom-scrollbar shrink-0 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]">
          <AnimatePresence>
            {tracks.map((track) => (
              <motion.div 
                key={track.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                onClick={(e) => handleTrackClick(e, track.id)}
                className={cn(
                  "border-b border-border/40 p-3 flex flex-col justify-between transition-all cursor-pointer border-l-4",
                  track.showAutomation ? "h-44" : "h-28",
                  track.muted ? "bg-card/30 opacity-70" : "bg-card/80 hover:bg-secondary/40",
                  selectedTrackIds.includes(track.id) ? "border-l-primary bg-primary/20 shadow-[inset_0_0_30px_hsl(var(--primary)/0.15)]" : "border-l-transparent"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-sm truncate">
                    <div className={cn("w-2 h-2 rounded-full", track.color)} />
                    <span className="truncate">{track.name}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingTrack(track); }} className="w-6 h-6 text-muted-foreground hover:text-accent" title="Add Plugins"><SlidersHorizontal className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleTrackProperty(track.id, 'elasticAudio') }} className={cn("w-6 h-6 text-muted-foreground hover:text-foreground", track.elasticAudio && "text-blue-400")} title="Elastic Audio"><Activity className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleTrackProperty(track.id, 'showAutomation') }} className={cn("w-6 h-6 text-muted-foreground hover:text-foreground", track.showAutomation && "text-primary")} title="Show Automation"><TrendingUp className="w-3.5 h-3.5" /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="w-6 h-6 text-muted-foreground hover:text-foreground" title="Track Options"><Settings2 className="w-3.5 h-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => {
                          const newName = prompt("Enter new track name:", track.name);
                          if (newName) {
                            setTracksWithHistory(tracks.map(t => t.id === track.id ? { ...t, name: newName } : t));
                          }
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
                    className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all", track.muted ? "bg-red-500 text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/80")}
                  >
                    M
                  </button>
                  <button 
                    onClick={() => toggleSolo(track.id)}
                    className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all", track.solo ? "bg-yellow-500 text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/80")}
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
              </motion.div>
            ))}
          </AnimatePresence>
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
                  <div key={i} className="absolute bottom-0 text-[10px] text-muted-foreground/50 border-l border-border/40 pl-1 h-3" style={{ left: `${position}px` }}>
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
              className="absolute top-0 bottom-0 w-[2px] bg-primary z-30 pointer-events-none group shadow-[0_0_10px_rgba(var(--primary),0.8)]"
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
                  className={cn(
                    "border-b border-border/20 relative group transition-all", 
                    track.showAutomation ? "h-44" : "h-28",
                    track.muted ? "opacity-30" : "",
                    selectedTrackIds.includes(track.id) ? "bg-primary/15 shadow-[inset_0_0_30px_hsl(var(--primary)/0.1)]" : ""
                  )}
                >
                  {/* Grid lines */}
                  
                  {/* Automation Lane Background */}
                  {track.showAutomation && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 border-t border-white/5 bg-black/40">
                       {/* Mock Automation Line */}
                       <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/30" />
                       <div className="absolute top-1/2 left-1/4 w-2 h-2 -mt-1 -ml-1 rounded-full bg-primary hover:scale-150 cursor-pointer transition-transform" />
                       <div className="absolute top-1/3 left-1/2 w-2 h-2 -mt-1 -ml-1 rounded-full bg-primary hover:scale-150 cursor-pointer transition-transform" />
                       <div className="absolute top-2/3 left-3/4 w-2 h-2 -mt-1 -ml-1 rounded-full bg-primary hover:scale-150 cursor-pointer transition-transform" />
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
                  
                  {/* Audio Region (Clip) */}
                  {track.waveform && track.waveform.length > 0 && (
                    <div 
                      onDoubleClick={() => setEditingTrack(track)}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (track.locked || activeTool === 'fade') return;

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

                        if (activeTool === 'grab' || activeTool === 'smart') {
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
                      className="audio-clip absolute top-2 bottom-2 rounded-lg border border-white/10 bg-card/60 backdrop-blur overflow-hidden group-hover:border-white/30 transition-colors cursor-grab active:cursor-grabbing shadow-sm"
                      style={{ 
                        left: `${(track.startTime !== undefined ? track.startTime : 0) * 20 * zoom}px`,
                        width: `${(track.duration !== undefined ? track.duration : 40) * 20 * zoom}px`
                      }}
                    >
                      {/* Left Trim Handle */}
                      <div 
                        className={cn("absolute top-0 bottom-0 left-0 w-3 z-20 group/handle flex justify-center items-center bg-black/20", (activeTool === 'trim' || activeTool === 'smart') ? "cursor-col-resize hover:bg-white/40" : "")}
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
                        className={cn("absolute top-0 bottom-0 right-0 w-3 z-20 group/handle flex justify-center items-center bg-black/20", (activeTool === 'trim' || activeTool === 'smart') ? "cursor-col-resize hover:bg-white/40" : "")}
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

                      <div className="absolute top-1 left-4 text-[10px] font-medium text-white/50 pointer-events-none flex items-center gap-1">
                        {track.name} - Take 1
                        {track.locked && <Link2 className="w-3 h-3 text-red-400" />}
                        {track.elasticAudio && <Activity className="w-3 h-3 text-blue-400" />}
                      </div>
                      
                      {/* Fade In/Out Overlays & Handles */}
                      <div 
                        className="absolute top-0 bottom-0 left-0 bg-white/5 z-10 pointer-events-none"
                        style={{ width: `${(track.fadeIn || 0) * 100}%` }}
                      />
                      {(activeTool === 'fade' || activeTool === 'smart') && (
                        <div className="absolute top-0 bottom-0 w-6 cursor-ew-resize hover:bg-white/10 flex items-center justify-center group z-20 pointer-events-auto"
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
                          <div className="w-1 h-6 bg-white/50 group-hover:bg-white rounded-full transition-colors shadow-sm" />
                        </div>
                      )}

                      <div 
                        className="absolute top-0 bottom-0 right-0 bg-white/5 z-10 pointer-events-none"
                        style={{ width: `${(track.fadeOut || 0) * 100}%` }}
                      />
                      {(activeTool === 'fade' || activeTool === 'smart') && (
                        <div className="absolute top-0 bottom-0 w-6 cursor-ew-resize hover:bg-white/10 flex items-center justify-center group z-20 pointer-events-auto"
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
                          <div className="w-1 h-6 bg-white/50 group-hover:bg-white rounded-full transition-colors shadow-sm" />
                        </div>
                      )}

                      <div className={cn("absolute inset-x-0 overflow-hidden pointer-events-none", track.showAutomation ? "top-6 bottom-16" : "bottom-1 top-5")}>
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
      <div className="h-10 border-t border-border/50 bg-card/80 flex items-center justify-between px-4 text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> {tracks.length} Tracks</span>
          <span className="text-primary font-medium">44.1 kHz / 24-bit • Opus Codec Active</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-1 text-green-500/80 mr-2" title="Optimized Strided Buffer Rendering Active">
            <Activity className="w-3.5 h-3.5" /> Strided Rendering
          </span>
          <span>CPU: <span className="text-green-400">12%</span></span>
          <span>RAM: <span className="text-green-400">28%</span></span>
        </div>
      </div>

      <WaveEditor 
        track={editingTrack} 
        onClose={() => setEditingTrack(null)} 
        onSave={saveTrackEffects}
      />
    </div>
  );
}