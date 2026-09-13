import { secureUploadFile } from "@/lib/secureUpload";
import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Square, Play, Pause, Save, Trash2, Loader2, Radio, RotateCcw, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/hooks/use-sound";
import { useAudioDevices } from "@/hooks/useAudioDevices";
import MicCheckPanel from "@/components/record/MicCheckPanel";
import RecordingCountdown from "@/components/record/RecordingCountdown";
import RecordingTips from "@/components/record/RecordingTips";
import RecordingGuide from "@/components/record/RecordingGuide";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const GUIDE_KEY = "nali_rec_guide_done";

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
}

function recordingExtension(mimeType = "") {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export default function Record() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [saving, setSaving] = useState(null);
  const { user: currentUser } = useAuth();
  const [visualData, setVisualData] = useState(new Array(64).fill(0));
  const [recLevel, setRecLevel] = useState(0);
  const [countdown, setCountdown] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const { devices, selectedDevices, selectDevice } = useAudioDevices();

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);
  const currentTimeRef = useRef(0);
  const audioCtxRef = useRef(null);
  const recordingsRef = useRef([]);
  const recordingGenerationRef = useRef(0);
  const activeUserIdRef = useRef(currentUser?.id || null);
  recordingsRef.current = recordings;

  useEffect(() => {
    const nextUserId = currentUser?.id || null;
    if (activeUserIdRef.current === nextUserId) return;

    recordingGenerationRef.current += 1;
    activeUserIdRef.current = nextUserId;
    setCountdown(false);
    setIsRecording(false);
    setIsPaused(false);
    setSaving(null);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setVisualData(new Array(64).fill(0));
    setRecLevel(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;

    recordingsRef.current.forEach((recording) => {
      if (recording.url?.startsWith("blob:")) {
        try { URL.revokeObjectURL(recording.url); } catch {}
      }
    });
    setRecordings([]);
  }, [currentUser?.id]);

  useEffect(() => {
    try {
      if (localStorage.getItem(GUIDE_KEY) !== "1") setShowGuide(true);
    } catch {}
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close().catch(() => {});
      }
      recordingsRef.current.forEach((recording) => {
        if (recording.url?.startsWith("blob:")) {
          try { URL.revokeObjectURL(recording.url); } catch {}
        }
      });
    };
  }, []);

  const updateVisualizer = () => {
    if (!analyserRef.current) return;
    const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(freqData);
    const sampled = Array.from({ length: 64 }, (_, i) =>
      freqData[Math.floor(i * freqData.length / 64)] / 255
    );
    setVisualData(sampled);

    // Peak level (time-domain) for smart tips.
    const timeData = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(timeData);
    let peak = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = Math.abs(timeData[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    setRecLevel(peak);

    animationRef.current = requestAnimationFrame(updateVisualizer);
  };

  const startRecording = async () => {
    setCountdown(false);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Audio recording is not supported in this browser.");
      return;
    }

    let stream = null;
    let audioCtx = null;
    try {
      const devId = selectedDevices.input && selectedDevices.input !== "default" ? selectedDevices.input : undefined;
      const constraints = { audio: devId ? { deviceId: { exact: devId } } : true };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser");

      audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const recordingGeneration = recordingGenerationRef.current;
      const recordingMimeType = recorder.mimeType || mimeType || "audio/webm";
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (streamRef.current === stream) streamRef.current = null;
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        const blob = new Blob(chunksRef.current, { type: recordingMimeType });
        if (blob.size > 0 && recordingGeneration === recordingGenerationRef.current) {
          const url = URL.createObjectURL(blob);
          setRecordings(prev => [...prev, {
            id: Date.now().toString(),
            blob,
            url,
            duration: currentTimeRef.current,
            name: `Recording ${prev.length + 1}`,
          }]);
        } else {
          toast.error("No audio was captured. Please check your microphone and try again.");
        }
        if (audioCtxRef.current === audioCtx && audioCtx.state !== "closed") {
          void audioCtx.close().catch(() => {});
          audioCtxRef.current = null;
        }
        setCurrentTime(0);
        currentTimeRef.current = 0;
        setVisualData(new Array(64).fill(0));
        setRecLevel(0);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      sounds.recStart();
      setIsRecording(true);
      setIsPaused(false);
      currentTimeRef.current = 0;
      timerRef.current = setInterval(() => {
        setCurrentTime(t => t + 1);
        currentTimeRef.current += 1;
      }, 1000);
      updateVisualizer();
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === stream) streamRef.current = null;
      if (audioCtx && audioCtx.state !== "closed") {
        void audioCtx.close().catch(() => {});
      }
      if (audioCtxRef.current === audioCtx) audioCtxRef.current = null;
      mediaRecorderRef.current = null;
      console.error("Recording start failed:", error);
      const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      toast.error(denied
        ? "Microphone access was denied. Allow microphone access and try again."
        : "Recording could not start. Check your microphone and browser permissions.");
    }
  };

  const beginRecording = () => {
    if (isRecording) return;
    setCountdown(true);
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
      timerRef.current = setInterval(() => {
        setCurrentTime(t => t + 1);
        currentTimeRef.current += 1;
      }, 1000);
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
    try {
      const extension = recordingExtension(rec.blob.type);
      const file = new File([rec.blob], `${rec.name}.${extension}`, { type: rec.blob.type || "audio/webm" });
      const { file_url } = await secureUploadFile({ file });
      const created = await base44.functions.invoke("createSharedFileRecord", {
        name: rec.name,
        file_url,
        file_type: "audio",
        file_size: file.size,
      });
      if (created?.data?.error) throw new Error(created.data.error);
      if (
        created?.data?.success !== true ||
        created?.data?.action !== "create_shared_file" ||
        created?.data?.userId !== currentUser?.id ||
        created?.data?.fileId !== created?.data?.file?.id ||
        created?.data?.file?.uploader_id !== currentUser?.id
      ) throw new Error("Recording save was not confirmed.");
      toast.success("Recording saved to Files.");
    } catch (error) {
      console.error("Recording save failed:", error);
      toast.error(error?.message || "Recording could not be saved. The local recording is still available.");
    } finally {
      setSaving(null);
    }
  };

  const deleteRecording = (id) => {
    setRecordings((prev) => {
      const recording = prev.find((item) => item.id === id);
      if (recording?.url?.startsWith("blob:")) {
        try { URL.revokeObjectURL(recording.url); } catch {}
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-heading font-bold mb-2">Recording Studio</h1>
          <p className="text-sm text-muted-foreground">Capture your ideas with professional-quality recording</p>
        </div>

        {/* Pre-flight mic check */}
        <div className="mb-6">
          <MicCheckPanel
            devices={devices.input}
            selectedDevice={selectedDevices.input}
            onSelectDevice={(id) => selectDevice("input", id)}
            recording={isRecording}
          />
        </div>

        {/* Immersive Visualizer */}
        <div className="relative flex flex-col items-center justify-center mb-4">
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

            <div className="relative z-10 flex flex-col items-center gap-3">
              {!isRecording ? (
                <motion.button
                  onClick={beginRecording}
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

        {/* Smart tips during recording */}
        {isRecording && (
          <RecordingTips level={recLevel} isPaused={isPaused} />
        )}

        {/* Friendly empty state */}
        {!isRecording && recordings.length === 0 && (
          <div className="text-center mb-4 px-4">
            <p className="text-sm text-muted-foreground">
              Press the glowing button to record. You'll get a 3-second countdown first so you're never caught off guard.
            </p>
            <button
              onClick={() => setShowGuide(true)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <HelpCircle className="w-3.5 h-3.5" /> New to recording? Replay the guide
            </button>
          </div>
        )}

        {/* Recordings */}
        {recordings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-semibold text-lg">Recordings</h2>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Nothing is saved until you choose to save — retake freely
              </span>
            </div>
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

      {/* Countdown overlay */}
      <AnimatePresence>
        {countdown && (
          <RecordingCountdown
            onComplete={startRecording}
            onCancel={() => setCountdown(false)}
          />
        )}
      </AnimatePresence>

      {/* First-time guided flow */}
      <RecordingGuide open={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}

function RecordingItem({ recording, saving, onSave, onDelete, onRename }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch (error) {
      console.error("Recording playback failed:", error);
      setPlaying(false);
      toast.error("Couldn't play this recording. Please try again.");
    }
  };

  return (
    <div className="bg-card/50 backdrop-blur-xl rounded-xl border border-white/[0.06] p-4 flex items-center gap-3">
      <audio ref={audioRef} src={recording.url} onEnded={() => setPlaying(false)} />
      <button onClick={togglePlay} className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0 hover:bg-primary/30 transition-colors">
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
        <Button size="icon" variant="ghost" className="w-11 h-11 rounded-lg" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="w-11 h-11 rounded-lg text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}