import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Square, Pause, Radio, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RecordingDialog({ open, onOpenChange, onSave, projectId, currentUser }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [recordingName, setRecordingName] = useState("Recording");
  const [saving, setSaving] = useState(false);
  const [visualData, setVisualData] = useState(new Array(64).fill(0));

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (isRecording) stopRecording();
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

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

  const handleSave = async () => {
    setSaving(true);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const file = new File([blob], `${recordingName}.webm`, { type: "audio/webm" });
    await onSave(file, recordingName);
    setSaving(false);
    setIsRecording(false);
    setCurrentTime(0);
    setRecordingName("Recording");
    onOpenChange(false);
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Audio</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-6 py-6">
          {/* Visualizer */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 192 192">
              {visualData.slice(0, 48).map((v, i) => {
                const angle = (i / 48) * 2 * Math.PI - Math.PI / 2;
                const innerR = 60;
                const barH = isRecording && !isPaused ? Math.max(2, v * 40) : 2;
                const outerR = innerR + barH;
                const x1 = 96 + Math.cos(angle) * innerR;
                const y1 = 96 + Math.sin(angle) * innerR;
                const x2 = 96 + Math.cos(angle) * outerR;
                const y2 = 96 + Math.sin(angle) * outerR;
                const lit = isRecording && !isPaused ? 55 + v * 25 : 30;
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={`hsl(265 80% ${lit}%)`}
                    strokeWidth="2" strokeLinecap="round"
                  />
                );
              })}
            </svg>

            {/* Center button */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              {!isRecording ? (
                <motion.button
                  onClick={startRecording}
                  whileTap={{ scale: 0.93 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center bg-destructive/20 text-destructive"
                >
                  <Mic className="w-6 h-6" />
                </motion.button>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <motion.button
                    onClick={stopRecording}
                    whileTap={{ scale: 0.93 }}
                    className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center"
                  >
                    <Square className="w-5 h-5 text-white" />
                  </motion.button>
                  <button
                    onClick={togglePause}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground bg-secondary/60 hover:bg-secondary transition-all"
                  >
                    {isPaused ? <Radio className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                </div>
              )}
              <p className="text-2xl font-mono font-black">{formatTime(currentTime)}</p>
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

          {/* Recording saved, show save dialog */}
          {!isRecording && currentTime > 0 && (
            <div className="w-full space-y-3">
              <Input
                placeholder="Recording name..."
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                className="bg-secondary/50 border-border/50 rounded-lg"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-lg"
                  onClick={() => {
                    setCurrentTime(0);
                    setRecordingName("Recording");
                  }}
                >
                  Discard
                </Button>
                <Button
                  className="flex-1 rounded-lg bg-primary hover:bg-primary/90"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save to Track
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}