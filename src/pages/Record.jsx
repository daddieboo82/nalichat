import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Square, Play, Pause, Save, Trash2, Loader2, Radio } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Record() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [saving, setSaving] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [inputDevice, setInputDevice] = useState("");
  const [devices, setDevices] = useState([]);
  const [visualData, setVisualData] = useState(new Array(64).fill(0));

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
    navigator.mediaDevices.enumerateDevices().then(devs => {
      setDevices(devs.filter(d => d.kind === "audioinput"));
    });
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const updateVisualizer = () => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const sampled = Array.from({ length: 64 }, (_, i) =>
      data[Math.floor(i * data.length / 64)] / 255
    );
    setVisualData(sampled);
    animationRef.current = requestAnimationFrame(updateVisualizer);
  };

  const startRecording = async () => {
    const constraints = { audio: inputDevice ? { deviceId: { exact: inputDevice } } : true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;

    // Set up analyzer
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      setRecordings(prev => [...prev, {
        id: Date.now().toString(),
        blob,
        url,
        duration: currentTime,
        name: `Recording ${prev.length + 1}`,
      }]);
      setCurrentTime(0);
      setVisualData(new Array(64).fill(0));
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    timerRef.current = setInterval(() => setCurrentTime(t => t + 1), 1000);
    updateVisualizer();
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerRef.current);
  };

  const togglePause = () => {
    if (isPaused) {
      mediaRecorderRef.current?.resume();
      timerRef.current = setInterval(() => setCurrentTime(t => t + 1), 1000);
      updateVisualizer();
    } else {
      mediaRecorderRef.current?.pause();
      clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    setIsPaused(!isPaused);
  };

  const saveRecording = async (rec) => {
    setSaving(rec.id);
    const file = new File([rec.blob], `${rec.name}.webm`, { type: "audio/webm" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.SharedFile.create({
      name: rec.name,
      file_url,
      file_type: "audio",
      file_size: rec.blob.size,
      uploader_id: currentUser.id,
      uploader_name: currentUser.display_name || currentUser.full_name,
    });
    setSaving(null);
  };

  const deleteRecording = (id) => {
    setRecordings(prev => prev.filter(r => r.id !== id));
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold mb-2">Recording Studio</h1>
          <p className="text-sm text-muted-foreground">Capture your ideas with professional-quality recording</p>
        </div>

        {/* Input Device Selector */}
        <div className="flex justify-center mb-8">
          <Select value={inputDevice} onValueChange={setInputDevice}>
            <SelectTrigger className="w-64 bg-secondary/50 border-0 rounded-xl">
              <SelectValue placeholder="Select input device" />
            </SelectTrigger>
            <SelectContent>
              {devices.filter(d => d.deviceId).map(d => (
                <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Visualizer */}
        <div className="bg-card rounded-2xl border border-border p-8 mb-8">
          <div className="flex items-end justify-center gap-1 h-32 mb-6">
            {visualData.map((v, i) => (
              <motion.div
                key={i}
                className={cn(
                  "w-1.5 rounded-full",
                  isRecording && !isPaused ? "bg-primary" : "bg-muted-foreground/20"
                )}
                animate={{ height: Math.max(4, v * 128) }}
                transition={{ duration: 0.05 }}
              />
            ))}
          </div>

          {/* Timer */}
          <div className="text-center mb-6">
            <p className="text-5xl font-mono font-bold tracking-wider">{formatTime(currentTime)}</p>
            {isRecording && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm text-destructive font-medium">{isPaused ? "Paused" : "Recording"}</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {!isRecording ? (
              <Button
                size="lg"
                className="rounded-full w-20 h-20 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30"
                onClick={startRecording}
              >
                <Mic className="w-8 h-8" />
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full w-14 h-14 border-border"
                  onClick={togglePause}
                >
                  {isPaused ? <Radio className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                </Button>
                <Button
                  size="lg"
                  className="rounded-full w-20 h-20 bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/30"
                  onClick={stopRecording}
                >
                  <Square className="w-7 h-7" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Recordings */}
        {recordings.length > 0 && (
          <div>
            <h2 className="font-heading font-semibold text-lg mb-4">Recordings</h2>
            <div className="space-y-3">
              {recordings.map(rec => (
                <RecordingItem
                  key={rec.id}
                  recording={rec}
                  saving={saving === rec.id}
                  onSave={() => saveRecording(rec)}
                  onDelete={() => deleteRecording(rec.id)}
                  onRename={(name) => setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, name } : r))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecordingItem({ recording, saving, onSave, onDelete, onRename }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
      <audio ref={audioRef} src={recording.url} onEnded={() => setPlaying(false)} />
      <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 hover:bg-primary/30 transition-colors">
        {playing ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <Input
          value={recording.name}
          onChange={(e) => onRename(e.target.value)}
          className="bg-transparent border-0 p-0 h-auto text-sm font-medium focus-visible:ring-0"
        />
        <p className="text-[10px] text-muted-foreground">{Math.floor(recording.duration / 60)}:{String(recording.duration % 60).padStart(2, '0')} • {(recording.blob.size / 1024 / 1024).toFixed(1)} MB</p>
      </div>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}