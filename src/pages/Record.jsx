import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Mic, Square, Play, Pause, Save, Trash2, Loader2, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { sounds } from "@/hooks/use-sound";
import DeviceSelector from "@/components/audio/DeviceSelector";

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
    sounds.recStart();
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
    sounds.recStop();
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

        {/* Device Selector */}
        <div className="flex justify-center mb-8">
          <DeviceSelector compact={true} />
        </div>

        {/* Immersive Visualizer */}
        <div className="relative flex flex-col items-center justify-center mb-8">
          {/* Ambient outer glow */}
          <AnimatePresence>
            {isRecording && !isPaused && (
              <motion.div
                className="absolute inset-0 rounded-full pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ background: "radial-gradient(circle, hsl(265 80% 60% / 0.18) 0%, transparent 70%)" }}
              />
            )}
          </AnimatePresence>

          {/* Radial bar ring */}
          <div className="relative w-72 h-72 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 288 288" style={{ overflow: "visible" }}>
              {visualData.slice(0, 48).map((v, i) => {
                const angle = (i / 48) * 2 * Math.PI - Math.PI / 2;
                const innerR = 90;
                const barH = isRecording && !isPaused ? Math.max(4, v * 50) : 4;
                const outerR = innerR + barH;
                const x1 = 144 + Math.cos(angle) * innerR;
                const y1 = 144 + Math.sin(angle) * innerR;
                const x2 = 144 + Math.cos(angle) * outerR;
                const y2 = 144 + Math.sin(angle) * outerR;
                const hue = 265 + (i / 48) * 80;
                const lit = isRecording && !isPaused ? 55 + v * 25 : 30;
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={`hsl(${hue} 80% ${lit}%)`}
                    strokeWidth="2.5" strokeLinecap="round"
                    style={{ transition: "all 0.06s ease" }}
                  />
                );
              })}
            </svg>

            {/* Center button */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              {!isRecording ? (
                <motion.button
                  onClick={startRecording}
                  whileTap={{ scale: 0.93 }}
                  whileHover={{ scale: 1.05 }}
                  className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl shadow-primary/40"
                  style={{ background: "linear-gradient(135deg, hsl(265 80% 60%), hsl(340 80% 60%))" }}
                  animate={{ boxShadow: ["0 0 20px hsl(265 80% 60% / 0.3)", "0 0 40px hsl(265 80% 60% / 0.55)", "0 0 20px hsl(265 80% 60% / 0.3)"] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                >
                  <Mic className="w-9 h-9 text-white" />
                </motion.button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <motion.button
                    onClick={stopRecording}
                    whileTap={{ scale: 0.93 }}
                    className="w-24 h-24 rounded-full bg-destructive flex items-center justify-center shadow-2xl shadow-destructive/40"
                    animate={{ boxShadow: isPaused ? undefined : ["0 0 15px hsl(0 72% 51% / 0.4)", "0 0 35px hsl(0 72% 51% / 0.7)", "0 0 15px hsl(0 72% 51% / 0.4)"] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    <Square className="w-8 h-8 text-white" />
                  </motion.button>
                  <button
                    onClick={togglePause}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground bg-secondary/60 hover:bg-secondary transition-all"
                  >
                    {isPaused ? <Radio className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  </button>
                </div>
              )}

              {/* Timer */}
              <p className="text-3xl font-mono font-black tracking-wider mt-1">{formatTime(currentTime)}</p>
              {isRecording && (
                <div className="flex items-center gap-1.5">
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-destructive"
                    animate={{ opacity: isPaused ? 0.4 : [1, 0.2, 1] }}
                    transition={{ repeat: Infinity, duration: 0.9 }}
                  />
                  <span className="text-xs text-destructive font-semibold">{isPaused ? "Paused" : "REC"}</span>
                </div>
              )}
            </div>
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