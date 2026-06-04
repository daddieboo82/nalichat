import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, Square, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RecordingVisualizerWave from "./RecordingVisualizerWave";
import { motion } from "framer-motion";

export default function StudioRecorder({
  project,
  currentUser,
  canEdit,
  onRecordingComplete,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingName, setRecordingName] = useState("Recording");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyzerRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const queryClient = useQueryClient();

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup audio context for level monitoring
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      source.connect(analyzer);

      audioContextRef.current = audioContext;
      analyzerRef.current = analyzer;

      // Monitor audio level
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const levelInterval = setInterval(() => {
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(100, (average / 255) * 150));
      }, 50);

      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      return () => clearInterval(levelInterval);
    } catch (err) {
      setError(err.message);
      console.error("Recording error:", err);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    setIsRecording(false);
    clearInterval(timerRef.current);
    mediaRecorderRef.current.stop();

    // Stop all audio streams
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    audioContextRef.current?.close();

    // Wait for data to be available
    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        
        try {
          setSaving(true);
          const { file_url } = await base44.integrations.Core.UploadFile({
            file: blob,
          });

          await base44.entities.Track.create({
            project_id: project.id,
            name: recordingName || "Recording",
            file_url,
            type: "vocal",
            volume: 75,
            pan: 0,
            muted: false,
            solo: false,
            uploaded_by: currentUser.id,
            duration: recordingTime,
          });

          queryClient.invalidateQueries({ queryKey: ["tracks", project.id] });
          setRecordingTime(0);
          setRecordingName("Recording");
          setSaving(false);
          onRecordingComplete?.();
        } catch (err) {
          setError(err.message);
          setSaving(false);
        }
      };
      resolve();
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 overflow-y-auto bg-gradient-to-b from-secondary/10 to-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl space-y-8"
      >
        {/* Recording Status */}
        <div className="text-center">
          {isRecording ? (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-block"
            >
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-destructive/40 to-destructive/20 flex items-center justify-center mb-4 shadow-2xl shadow-destructive/40 border border-destructive/30">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-destructive/50 to-destructive/30 flex items-center justify-center border border-destructive/40">
                  <Mic className="w-10 h-10 text-destructive" />
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/40 to-accent/20 flex items-center justify-center mb-4 shadow-2xl shadow-primary/40 border border-primary/30">
              <Mic className="w-10 h-10 text-primary" />
            </div>
          )}
          
          <h2 className="text-2xl font-heading font-bold text-foreground mt-3">
            {isRecording ? "Recording..." : "Ready to Record"}
          </h2>
          <p className="text-muted-foreground text-sm mt-2">
            {isRecording ? "Keep those vocals clean!" : "Arm the microphone and hit record"}
          </p>
        </div>

        {/* Waveform Visualizer */}
        {isRecording && (
          <div className="bg-secondary/30 rounded-xl p-8 border border-border/30">
            <RecordingVisualizerWave audioLevel={audioLevel} />
          </div>
        )}

        {/* Recording Time */}
        {recordingTime > 0 && (
          <div className="text-center">
            <div className="font-mono text-4xl font-bold text-primary mb-3">
              {formatTime(recordingTime)}
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Recording time</p>
          </div>
        )}

        {/* Track Name Input */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-widest font-semibold block mb-2">
            Track Name
          </label>
          <Input
            value={recordingName}
            onChange={(e) => setRecordingName(e.target.value)}
            placeholder="Name this recording..."
            disabled={isRecording || saving}
            className="bg-secondary/40 border-border/50 text-center text-lg font-semibold rounded-xl h-12"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-destructive/20 border border-destructive/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Recording Error</p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-3 justify-center">
          {!isRecording ? (
            <Button
              size="lg"
              onClick={startRecording}
              disabled={saving}
              className="bg-destructive/90 hover:bg-destructive text-white font-semibold rounded-xl px-8 shadow-lg shadow-destructive/30"
            >
              <Mic className="w-5 h-5 mr-2" />
              Start Recording
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                onClick={stopRecording}
                disabled={saving}
                className="bg-primary/90 hover:bg-primary text-primary-foreground font-semibold rounded-xl px-8 shadow-lg shadow-primary/30"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Square className="w-5 h-5 mr-2" />
                    Stop & Save
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  setIsRecording(false);
                  clearInterval(timerRef.current);
                  mediaRecorderRef.current?.stop();
                  mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
                  setRecordingTime(0);
                  chunksRef.current = [];
                }}
                className="border-border/50 rounded-xl"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Discard
              </Button>
            </>
          )}
        </div>

        {/* Tips */}
        <div className="mt-12 bg-secondary/20 border border-border/30 rounded-xl p-6 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-2">Pro Tips</p>
          <ul className="text-sm text-muted-foreground/80 space-y-1">
            <li>• Keep your microphone at a consistent distance</li>
            <li>• Minimize background noise for clean recordings</li>
            <li>• Layer multiple takes to build depth</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}