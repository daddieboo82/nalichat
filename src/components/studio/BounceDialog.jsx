import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function BounceDialog({ projectTitle, tracks }) {
  const [open, setOpen] = useState(false);
  const [bounceTitle, setBounceTitle] = useState(`${projectTitle} - Bounce`);
  const [bouncing, setBouncing] = useState(false);
  const [error, setError] = useState("");

  const handleBounce = async () => {
    if (!bounceTitle.trim() || tracks.length === 0) return;
    setBouncing(true);
    setError("");

    try {
      // Validate tracks have audio
      const validTracks = tracks.filter(t => t.file_url && !t.muted);
      if (validTracks.length === 0) {
        setError("No unmuted tracks with audio to bounce.");
        setBouncing(false);
        return;
      }

      // Create WebAudio context to mix tracks
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const offlineContext = new OfflineAudioContext(
        2,
        audioContext.sampleRate * 300, // 5 minute max
        audioContext.sampleRate
      );

      let maxDuration = 0;

      // Load all audio sources
      for (const track of validTracks) {
        try {
          const response = await fetch(track.file_url);
          if (!response.ok) throw new Error(`Failed to load track: ${track.name}`);
          
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

          maxDuration = Math.max(maxDuration, audioBuffer.duration);

          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;

          // Apply volume and pan
          const gainNode = offlineContext.createGain();
          gainNode.gain.value = (track.volume || 75) / 100;

          source.connect(gainNode);
          gainNode.connect(offlineContext.destination);
          source.start(0);
        } catch (trackErr) {
          console.warn(`Failed to load track ${track.name}:`, trackErr);
        }
      }

      // Render mixed audio
      const renderedBuffer = await offlineContext.startRendering();

      // Convert to WAV blob
      const wav = bufferToWave(renderedBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });

      // Upload bounced file as FormData
      const formData = new FormData();
      formData.append('file', blob, `${bounceTitle}.wav`);

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
        featured: false,
        likes: 0,
        views: 0
      });

      setOpen(false);
      setBounceTitle(`${projectTitle} - Bounce`);
      setError("");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to bounce session";
      setError(errMsg);
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
          <DialogDescription>Mix all unmuted tracks and export as audio</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Bounce name"
            value={bounceTitle}
            onChange={(e) => setBounceTitle(e.target.value)}
            className="rounded-xl"
          />
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
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