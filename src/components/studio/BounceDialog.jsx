import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function BounceDialog({ projectTitle, tracks }) {
  const [open, setOpen] = useState(false);
  const [bounceTitle, setBounceTitle] = useState(`${projectTitle} - Bounce`);
  const [bouncing, setBouncing] = useState(false);

  const handleBounce = async () => {
    if (!bounceTitle.trim() || tracks.length === 0) return;
    setBouncing(true);

    try {
      // Create WebAudio context to mix tracks
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const offlineContext = new OfflineAudioContext(
        2,
        audioContext.sampleRate * 60, // 60 seconds max
        audioContext.sampleRate
      );

      const audioElements = [];
      let maxDuration = 0;

      // Load all audio sources
      for (const track of tracks) {
        if (!track.file_url || track.muted) continue;

        const response = await fetch(track.file_url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

        maxDuration = Math.max(maxDuration, audioBuffer.duration);

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;

        // Apply volume
        const gainNode = offlineContext.createGain();
        gainNode.gain.value = (track.volume || 75) / 100;

        source.connect(gainNode);
        gainNode.connect(offlineContext.destination);
        source.start(0);

        audioElements.push(source);
      }

      // Render mixed audio
      const renderedBuffer = await offlineContext.startRendering();

      // Convert to WAV blob
      const wav = bufferToWave(renderedBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });

      // Upload bounced file
      const { file_url } = await base44.integrations.Core.UploadFile({
        file: blob
      });

      // Store bounce session
      await base44.entities.ArtPost.create({
        title: bounceTitle,
        description: `Bounced session from ${projectTitle}`,
        file_url: file_url,
        medium: 'production',
        creator_id: (await base44.auth.me()).id,
        featured: false
      });

      setOpen(false);
      setBounceTitle(`${projectTitle} - Bounce`);
    } catch (err) {
      console.error('Bounce failed:', err);
    } finally {
      setBouncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl bg-accent hover:bg-accent/90">
          <Download className="w-4 h-4 mr-2" />
          Bounce Session
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-heading">Bounce & Export Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Bounce name"
            value={bounceTitle}
            onChange={(e) => setBounceTitle(e.target.value)}
            className="rounded-xl"
          />
          <Button
            onClick={handleBounce}
            disabled={!bounceTitle.trim() || bouncing}
            className="w-full rounded-xl bg-primary hover:bg-primary/90"
          >
            {bouncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Bounce Now
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function bufferToWave(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const channelData = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i));
  }

  const dataLength = audioBuffer.length * numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      let s = Math.max(-1, Math.min(1, channelData[channel][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  }

  return buffer;
}