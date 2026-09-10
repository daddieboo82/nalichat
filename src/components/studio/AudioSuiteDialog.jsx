import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Wand2, ArrowUpCircle, FlipHorizontal2, Gauge, Music2, Volume2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Pro Tools-style AudioSuite — offline audio processing.
 * Renders a new audio file with the selected effect applied non-destructively.
 */
export default function AudioSuiteDialog({ open, onOpenChange, track, onProcess }) {
  const [processType, setProcessType] = useState('normalize');
  const [gain, setGain] = useState(0); // dB
  const [pitch, setPitch] = useState(0); // semitones
  const [timeStretch, setTimeStretch] = useState(100); // percent
  const [isProcessing, setIsProcessing] = useState(false);

  const processes = [
    { id: 'normalize', label: 'Normalize', icon: ArrowUpCircle, desc: 'Peak normalize to 0 dB' },
    { id: 'gain', label: 'Gain', icon: Volume2, desc: 'Adjust clip volume in dB' },
    { id: 'reverse', label: 'Reverse', icon: FlipHorizontal2, desc: 'Reverse the audio' },
    { id: 'pitch', label: 'Pitch Shift', icon: Music2, desc: 'Shift pitch in semitones' },
    { id: 'stretch', label: 'Time Stretch', icon: Gauge, desc: 'Varispeed - changes duration and pitch together' },
    { id: 'silence', label: 'Silence', icon: RotateCcw, desc: 'Replace with silence' },
  ];

  const handleProcess = async () => {
    if (!track?.audioUrl) {
      toast.error("No audio on this track to process.");
      return;
    }
    setIsProcessing(true);
    try {
      // Fetch and decode the audio — works for both blob: and https: URLs
      const response = await fetch(track.audioUrl);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

      let processedBuffer = audioBuffer;
      let newDuration = audioBuffer.duration;

      if (processType === 'normalize') {
        // Find peak and scale to 0 dB
        let peak = 0;
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          const data = audioBuffer.getChannelData(ch);
          for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > peak) peak = abs;
          }
        }
        if (peak > 0) {
          const scale = 0.99 / peak;
          processedBuffer = audioCtx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
          for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            const src = audioBuffer.getChannelData(ch);
            const dst = processedBuffer.getChannelData(ch);
            for (let i = 0; i < src.length; i++) dst[i] = src[i] * scale;
          }
        }
      } else if (processType === 'gain') {
        const scale = Math.pow(10, gain / 20);
        processedBuffer = audioCtx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          const src = audioBuffer.getChannelData(ch);
          const dst = processedBuffer.getChannelData(ch);
          for (let i = 0; i < src.length; i++) dst[i] = Math.max(-1, Math.min(1, src[i] * scale));
        }
      } else if (processType === 'reverse') {
        processedBuffer = audioCtx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          const src = audioBuffer.getChannelData(ch);
          const dst = processedBuffer.getChannelData(ch);
          for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i];
        }
      } else if (processType === 'silence') {
        processedBuffer = audioCtx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          processedBuffer.getChannelData(ch).fill(0);
        }
      } else if (processType === 'pitch' || processType === 'stretch') {
        // Simple resampling for pitch/stretch
        const ratio = processType === 'pitch'
          ? Math.pow(2, pitch / 12) // pitch shift via playback rate
          : timeStretch / 100; // time stretch via inverse playback rate
        const newLength = Math.floor(audioBuffer.length / ratio);
        processedBuffer = audioCtx.createBuffer(audioBuffer.numberOfChannels, newLength, audioBuffer.sampleRate);
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          const src = audioBuffer.getChannelData(ch);
          const dst = processedBuffer.getChannelData(ch);
          for (let i = 0; i < newLength; i++) {
            const srcIdx = i * ratio;
            const idx0 = Math.floor(srcIdx);
            const frac = srcIdx - idx0;
            dst[i] = src[idx0] * (1 - frac) + (src[idx0 + 1] || 0) * frac;
          }
        }
        newDuration = audioBuffer.duration / ratio;
      }

      // Encode to WAV
      const wavBlob = bufferToWav(processedBuffer);
      const newUrl = URL.createObjectURL(wavBlob);

      // Generate new waveform
      const numPoints = 8000;
      const waveform = new Float32Array(numPoints);
      const channelData = processedBuffer.getChannelData(0);
      const blockSize = Math.max(1, Math.floor(channelData.length / numPoints));
      let maxVal = 0;
      for (let i = 0; i < numPoints; i++) {
        let peak = 0;
        for (let j = 0; j < blockSize; j++) {
          const abs = Math.abs(channelData[i * blockSize + j] || 0);
          if (abs > peak) peak = abs;
        }
        waveform[i] = peak;
        if (peak > maxVal) maxVal = peak;
      }
      const normalizedWaveform = maxVal > 0 ? Array.from(waveform).map(v => v / maxVal) : Array.from(waveform).map(() => 0.05);

      audioCtx.close();
      onProcess({ audioUrl: newUrl, waveform: normalizedWaveform, duration: newDuration });
      toast.success(`${processes.find(p => p.id === processType).label} applied!`);
      onOpenChange(false);
    } catch (e) {
      console.error('AudioSuite error:', e);
      toast.error("Processing failed — couldn't decode the audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            AudioSuite — Offline Processing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-xs text-muted-foreground">
            Processing: <span className="font-semibold text-foreground">{track?.name || 'No track selected'}</span>
          </div>

          {/* Process type grid */}
          <div className="grid grid-cols-3 gap-2">
            {processes.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setProcessType(p.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all text-center",
                    processType === p.id
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">{p.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-muted-foreground italic">
            {processes.find(p => p.id === processType)?.desc}
          </div>

          {/* Parameter sliders */}
          {processType === 'gain' && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span>Gain</span><span className="font-mono text-primary">{gain > 0 ? '+' : ''}{gain} dB</span></div>
              <Slider value={[gain]} min={-24} max={24} step={0.5} onValueChange={v => setGain(v[0])} />
            </div>
          )}
          {processType === 'pitch' && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span>Pitch</span><span className="font-mono text-primary">{pitch > 0 ? '+' : ''}{pitch} st</span></div>
              <Slider value={[pitch]} min={-12} max={12} step={1} onValueChange={v => setPitch(v[0])} />
            </div>
          )}
          {processType === 'stretch' && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span>Time Stretch</span><span className="font-mono text-primary">{timeStretch}%</span></div>
              <Slider value={[timeStretch]} min={50} max={200} step={5} onValueChange={v => setTimeStretch(v[0])} />
              <p className="text-[10px] text-muted-foreground">Varispeed: pitch shifts with the tempo change, like a tape machine.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleProcess} disabled={isProcessing || !track?.audioUrl} className="gap-2">
            {isProcessing ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {isProcessing ? 'Processing...' : 'Process'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// WAV encoder for AudioBuffer
function bufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };

  writeString(0, 'RIFF');
  view.setUint32(4, length - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length - 44, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}