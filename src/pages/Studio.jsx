import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, Square, Circle, Mic, Plus, Settings2, Volume2, 
  Scissors, Copy, Save, Download, FastForward, Rewind, MoreVertical,
  Maximize2, Pause, Layers, Headphones, Speaker, Keyboard, Upload,
  Cpu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import WaveEditor from '@/components/studio/WaveEditor';

// Fake waveform generator
const generateWaveform = (length = 100) => {
  return Array.from({ length }, () => Math.random() * 0.8 + 0.1);
};

export default function Studio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const playheadRef = useRef(null);
  const [editingTrack, setEditingTrack] = useState(null);
  const [maxTracks, setMaxTracks] = useState(2); // Free tier default
  
  const [tracks, setTracks] = useState([
    { id: 1, name: "Vocals Lead", color: "bg-primary", volume: 80, pan: 50, muted: false, solo: false, waveform: generateWaveform(120) },
    { id: 2, name: "Beat / Instrumental", color: "bg-accent", volume: 90, pan: 50, muted: false, solo: false, waveform: generateWaveform(120) },
  ]);

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

  // Simulate playback
  useEffect(() => {
    let interval;
    if (isPlaying || isRecording) {
      interval = setInterval(() => {
        setCurrentTime((prev) => (prev + 0.1 > 100 ? 0 : prev + 0.1));
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isRecording]);

  const togglePlay = () => {
    if (isRecording) setIsRecording(false);
    setIsPlaying(!isPlaying);
  };

  const toggleRecord = () => {
    if (isPlaying) setIsPlaying(false);
    setIsRecording(!isRecording);
    if (!isRecording) {
      toast.success("Recording started");
    }
  };

  const stop = () => {
    setIsPlaying(false);
    setIsRecording(false);
    setCurrentTime(0);
  };

  const toggleMute = (trackId) => {
    setTracks(tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const toggleSolo = (trackId) => {
    setTracks(tracks.map(t => t.id === trackId ? { ...t, solo: !t.solo } : t));
  };

  const updateVolume = (trackId, val) => {
    setTracks(tracks.map(t => t.id === trackId ? { ...t, volume: val[0] } : t));
  };

  const addTrack = () => {
    if (tracks.length >= maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). Upgrade your plan to add more tracks.`);
      return;
    }

    const newId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
    const colors = ["bg-primary", "bg-pink-500", "bg-accent", "bg-yellow-500", "bg-purple-500", "bg-green-500"];
    setTracks([...tracks, {
      id: newId,
      name: `New Track ${newId}`,
      color: colors[newId % colors.length],
      volume: 75,
      pan: 50,
      muted: false,
      solo: false,
      waveform: generateWaveform(120)
    }]);
    toast.success("Track added");
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const saveTrackEffects = (trackId, updatedTrack) => {
    setTracks(tracks.map(t => t.id === trackId ? updatedTrack : t));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-16 border-b border-border/50 bg-card/80 backdrop-blur flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="font-heading font-black text-xl text-gradient-animate tracking-tight flex items-center gap-2">
            <Mic className="w-6 h-6 text-primary" />
            NaliStudio <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest ml-2">Pro</span>
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
            <Button variant="ghost" size="icon" title="Audio Interface" className="w-8 h-8 rounded-lg text-green-400 hover:bg-secondary"><Cpu className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" title="Microphone Input" className="w-8 h-8 rounded-lg text-green-400 hover:bg-secondary"><Mic className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" title="Headphones Output" className="w-8 h-8 rounded-lg text-green-400 hover:bg-secondary"><Headphones className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" title="MIDI Controller" className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><Keyboard className="w-4 h-4" /></Button>
          </div>

          <div className="font-mono text-xl text-primary font-bold bg-primary/10 px-4 py-1.5 rounded-lg border border-primary/20 w-32 text-center">
            {formatTime(currentTime)}
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" className="gap-2 rounded-xl border-border/50" onClick={() => toast("Imported WAV/MP3/MIDI")}>
              <Upload className="w-4 h-4" /> Import
            </Button>
            <Button className="gap-2 rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary" onClick={() => toast.success("Exporting to WAV (24-bit)")}>
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
        <span className="text-xs font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md shrink-0">
          Tracks: {tracks.length} / {maxTracks > 100 ? "Unlimited" : maxTracks}
        </span>
        <div className="h-5 w-px bg-border/50 mx-2 shrink-0" />
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md text-muted-foreground hover:text-foreground"><Scissors className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md text-muted-foreground hover:text-foreground"><Copy className="w-4 h-4" /></Button>
        </div>
        <div className="h-5 w-px bg-border/50 mx-2 shrink-0" />
        <div className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground bg-secondary/30 px-3 py-1 rounded-lg">
          <span className="font-medium text-foreground">Formats:</span> 
          <span>WAV</span> • <span>MP3</span> • <span>FLAC</span> • <span>OGG</span> • <span>MIDI</span>
        </div>
        <div className="flex items-center gap-3 ml-auto text-sm text-muted-foreground shrink-0 pl-4">
          <Maximize2 className="w-4 h-4" /> Zoom
          <Slider 
            value={[zoom]} 
            min={0.5} 
            max={3} 
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
                className={cn(
                  "h-28 border-b border-border/40 p-3 flex flex-col justify-between transition-colors",
                  track.muted ? "bg-card/30 opacity-70" : "bg-card/80 hover:bg-secondary/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-sm truncate">
                    <div className={cn("w-2 h-2 rounded-full", track.color)} />
                    <span className="truncate">{track.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground"><Settings2 className="w-3.5 h-3.5" /></Button>
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
                  <button className="px-2 py-0.5 rounded text-xs font-bold bg-secondary text-muted-foreground hover:bg-red-500/20 hover:text-red-400 transition-all flex items-center justify-center">
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
          <div className="h-8 border-b border-border/30 bg-card/40 sticky top-0 z-20 flex items-end px-4 overflow-hidden">
            {/* Timeline markers */}
            <div className="w-[2000px] h-full relative" style={{ transform: `scaleX(${zoom})`, transformOrigin: 'left' }}>
              {Array.from({ length: 50 }).map((_, i) => (
                <div key={i} className="absolute bottom-0 text-[10px] text-muted-foreground/50 border-l border-border/40 pl-1 h-3" style={{ left: `${i * 100}px` }}>
                  0:{i.toString().padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>

          {/* Tracks Area */}
          <div className="relative w-[2000px] min-h-full" style={{ transform: `scaleX(${zoom})`, transformOrigin: 'top left' }}>
            {/* Playhead */}
            <div 
              ref={playheadRef}
              className="absolute top-0 bottom-0 w-px bg-primary z-30 pointer-events-none"
              style={{ left: `${currentTime * 20}px` }}
            >
              <div className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-primary rotate-45" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
            </div>

            {/* Waveform Rows */}
            <div className="flex flex-col">
              {tracks.map((track) => (
                <div key={track.id} className={cn("h-28 border-b border-border/20 relative group", track.muted ? "opacity-30" : "")}>
                  {/* Grid lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px)] bg-[size:100px_100%]" />
                  
                  {/* Audio Region (Clip) */}
                  <div 
                    onDoubleClick={() => setEditingTrack(track)}
                    className="absolute top-2 bottom-2 left-10 w-[800px] rounded-lg border border-white/10 bg-card/60 backdrop-blur overflow-hidden group-hover:border-white/30 transition-colors cursor-pointer"
                  >
                    <div className="absolute top-1 left-2 text-[10px] font-medium text-white/50">{track.name} - Take 1</div>
                    <div className="absolute inset-x-0 bottom-2 top-6 flex items-center justify-center gap-px px-2">
                      {track.waveform.map((val, i) => (
                        <div 
                          key={i} 
                          className={cn("w-1 rounded-full opacity-80", track.color)}
                          style={{ height: `${val * 100}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Mixer / Status Bar */}
      <div className="h-10 border-t border-border/50 bg-card/80 flex items-center justify-between px-4 text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> {tracks.length} Tracks</span>
          <span className="text-primary font-medium">44.1 kHz / 24-bit</span>
        </div>
        <div className="flex items-center gap-4">
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