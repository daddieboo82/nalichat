import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/responsive-select';
import {
  X, ArrowRight, ArrowLeft, Mic, ShieldCheck, Activity, Play, Square,
  CheckCircle2, Volume2, Sparkles, RotateCcw
} from 'lucide-react';
import { useMicMonitor } from '@/hooks/useMicMonitor';
import { useAudioDevices } from '@/hooks/useAudioDevices';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'nali_rec_guide_done';

/**
 * Guided first-time recording flow, narrated aloud via the browser's
 * speechSynthesis (warm voice when available). Walks the user through:
 * allow mic → pick mic → test levels → practice a 5s recording → ready.
 *
 * Shows once per browser; can be re-opened via the `open` prop.
 */
export default function RecordingGuide({ open, onClose }) {
  const { devices, selectedDevices, selectDevice } = useAudioDevices();
  const { permission, level, monitoring, start, stop } = useMicMonitor();
  const [step, setStep] = useState(0);
  const [muted, setMuted] = useState(false);
  const [practiceUrl, setPracticeUrl] = useState(null);
  const [practiceRecording, setPracticeRecording] = useState(false);
  const [practiceTimer, setPracticeTimer] = useState(0);
  const practiceRecRef = useRef(null);
  const practiceChunksRef = useRef([]);
  const practiceStreamRef = useRef(null);
  const practiceTimerRef = useRef(null);
  const practiceStopTimeoutRef = useRef(null);
  const practiceUrlRef = useRef(null);

  const steps = [
    { key: 'welcome', title: "Let's get you recording", icon: Sparkles },
    { key: 'permission', title: 'Allow microphone access', icon: ShieldCheck },
    { key: 'device', title: 'Pick your microphone', icon: Mic },
    { key: 'levels', title: 'Test your levels', icon: Activity },
    { key: 'practice', title: 'Practice a take', icon: Play },
    { key: 'ready', title: "You're all set!", icon: CheckCircle2 },
  ];

  const speak = (text) => {
    if (muted) return;
    try {
      if (!window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1; u.pitch = 1.05;
      const voices = window.speechSynthesis.getVoices();
      const warm = voices.find(v => /samantha|zira|google uk english female|female|aria|jenny/i.test(v.name));
      if (warm) u.voice = warm;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  };

  // Narrate each step.
  useEffect(() => {
    if (!open) return;
    const narration = [
      "Welcome! I'll walk you through recording in NaliChat. You can do this — let's start by allowing microphone access.",
      "Click the button to allow microphone access. Your browser will ask for permission — choose Allow.",
      "Pick the microphone you want to use from the list. If you're not sure, the default is fine.",
      "Say something out loud and watch the level meter move. Aim for the green zone when you speak normally.",
      "Let's practice! Hit record, talk for a few seconds, then play it back. Nothing is saved — you can redo this as many times as you like.",
      "You're all set! Remember: nothing is permanent until you choose to save, and you can retake as many times as you want. Happy recording!",
    ];
    speak(narration[step]);
    return () => { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, open, muted]);

  // Start monitoring once permission is granted (for the levels step).
  useEffect(() => {
    if (open && permission === 'granted' && !monitoring && step >= 3 && step <= 4) {
      start(selectedDevices.input);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, permission, step]);

  // Cleanup on close.
  useEffect(() => {
    if (!open) {
      stop();
      stopPractice();
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stopPractice = () => {
    if (practiceStopTimeoutRef.current) {
      clearTimeout(practiceStopTimeoutRef.current);
      practiceStopTimeoutRef.current = null;
    }
    if (practiceRecRef.current && practiceRecRef.current.state !== 'inactive') {
      try { practiceRecRef.current.stop(); } catch {}
    }
    if (practiceStreamRef.current) {
      practiceStreamRef.current.getTracks().forEach(t => t.stop());
      practiceStreamRef.current = null;
    }
    if (practiceTimerRef.current) clearInterval(practiceTimerRef.current);
    practiceRecRef.current = null;
    setPracticeRecording(false);
    setPracticeTimer(0);
  };

  useEffect(() => () => {
    stopPractice();
    if (practiceUrlRef.current) {
      URL.revokeObjectURL(practiceUrlRef.current);
      practiceUrlRef.current = null;
    }
  }, []);

  const doPracticeRecord = async () => {
    if (practiceUrlRef.current) {
      URL.revokeObjectURL(practiceUrlRef.current);
      practiceUrlRef.current = null;
    }
    setPracticeUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      practiceStreamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      practiceChunksRef.current = [];
      rec.ondataavailable = (e) => practiceChunksRef.current.push(e.data);
      rec.onstop = () => {
        if (practiceStopTimeoutRef.current) {
          clearTimeout(practiceStopTimeoutRef.current);
          practiceStopTimeoutRef.current = null;
        }
        const blob = new Blob(practiceChunksRef.current, { type: 'audio/webm' });
        const nextUrl = URL.createObjectURL(blob);
        practiceUrlRef.current = nextUrl;
        setPracticeUrl(nextUrl);
        if (practiceStreamRef.current) {
          practiceStreamRef.current.getTracks().forEach(t => t.stop());
          practiceStreamRef.current = null;
        }
        setPracticeRecording(false);
        if (practiceTimerRef.current) clearInterval(practiceTimerRef.current);
        setPracticeTimer(0);
      };
      practiceRecRef.current = rec;
      rec.start();
      setPracticeRecording(true);
      setPracticeTimer(0);
      practiceTimerRef.current = setInterval(() => setPracticeTimer(t => t + 1), 1000);
      practiceStopTimeoutRef.current = setTimeout(() => {
        practiceStopTimeoutRef.current = null;
        if (rec.state !== 'inactive') { try { rec.stop(); } catch {} }
      }, 5000);
    } catch (err) {
      setPracticeUrl(null);
    }
  };

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    onClose();
  };

  const levelPct = Math.min(100, level * 100);

  if (!open) return null;

  const StepIcon = steps[step].icon;
  const isLast = step === steps.length - 1;
  const canAdvance = step !== 1 || permission === 'granted';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[95] flex items-center justify-center bg-background/85 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.96, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.96, y: 12, opacity: 0 }}
          className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <StepIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recording guide · {step + 1} of {steps.length}</p>
                <h3 className="text-sm font-semibold">{steps[step].title}</h3>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMuted(m => !m)}
                className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs', muted ? 'text-muted-foreground bg-secondary' : 'text-primary bg-primary/10')}
                title={muted ? 'Unmute narration' : 'Mute narration'}
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 py-3 bg-secondary/20">
            {steps.map((s, i) => (
              <div key={s.key} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-border')} />
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {step === 0 && (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  New to recording? No worries — I'll guide you through it step by step,
                  and you can hear me talk you through each part.
                </p>
                <ul className="text-left text-sm space-y-2 max-w-sm mx-auto">
                  <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Allow your microphone</li>
                  <li className="flex items-center gap-2"><Mic className="w-4 h-4 text-primary" /> Pick the right input</li>
                  <li className="flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /> Check your levels</li>
                  <li className="flex items-center gap-2"><Play className="w-4 h-4 text-yellow-400" /> Practice a take</li>
                </ul>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Your browser needs permission to use your mic. Click below, then choose <strong className="text-foreground">Allow</strong> in the prompt.
                </p>
                {permission === 'granted' ? (
                  <div className="flex flex-col items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-10 h-10" />
                    <p className="text-sm font-medium">Microphone access granted!</p>
                  </div>
                ) : (
                  <Button onClick={() => start(selectedDevices.input)} className="h-11 px-6">
                    <Mic className="w-4 h-4 mr-2" /> Allow microphone
                  </Button>
                )}
                {permission === 'denied' && (
                  <p className="text-xs text-destructive">
                    Access is blocked. Update your browser site permissions to allow the microphone, then try again.
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Choose the microphone you'll record with.
                </p>
                <Select value={selectedDevices.input || 'default'} onValueChange={(v) => selectDevice('input', v)}>
                  <SelectTrigger className="w-full px-3 py-2.5 rounded-lg bg-secondary/40 border border-border text-sm h-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default mic</SelectItem>
                    {devices.input.map((device, idx) => {
                      const id = device.deviceId || `input-${idx}`;
                      return <SelectItem key={id} value={id}>{device.label || `Microphone ${idx + 1}`}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground text-center">
                  Not sure? The default usually works. You can change it anytime on the record screen.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Say something out loud and watch the meter respond. Aim for the green zone.
                </p>
                <div className="relative h-4 rounded-full bg-secondary overflow-hidden border border-border">
                  <div className="absolute inset-y-0 left-0 bg-emerald-500/30" style={{ width: '40%' }} />
                  <div className="absolute inset-y-0 bg-yellow-500/30" style={{ left: '40%', width: '50%' }} />
                  <div className="absolute inset-y-0 right-0 bg-red-500/30" style={{ width: '10%' }} />
                  <motion.div
                    className="h-full bg-emerald-500 rounded-full"
                    animate={{ width: `${levelPct}%` }}
                    transition={{ duration: 0.05 }}
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  {level > 0.05 ? "Nice — I can hear you!" : level > 0.01 ? 'Getting there — speak up a little.' : 'Make some noise to see the meter move.'}
                </p>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Try a 5-second recording. Nothing is saved — this is just practice.
                </p>
                <div className="flex flex-col items-center gap-3">
                  {!practiceRecording && !practiceUrl && (
                    <Button onClick={doPracticeRecord} className="h-11 px-6">
                      <Mic className="w-4 h-4 mr-2" /> Record 5 seconds
                    </Button>
                  )}
                  {practiceRecording && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center animate-pulse">
                        <Square className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-sm font-mono">{practiceTimer}s / 5s</p>
                    </div>
                  )}
                  {practiceUrl && !practiceRecording && (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <audio src={practiceUrl} controls className="w-full" />
                      <Button variant="outline" size="sm" onClick={doPracticeRecord}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Try again
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Don't like it? Just try again — you can redo this as many times as you want.
                </p>
              </div>
            )}

            {step === 5 && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <p className="text-sm text-muted-foreground">
                  You're ready to record for real. Remember: nothing is permanent until you
                  choose to save, and you can retake as many times as you like.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-border">
            <Button variant="ghost" size="sm" onClick={step === 0 ? onClose : () => setStep(s => s - 1)} disabled={practiceRecording}>
              {step === 0 ? 'Skip guide' : <><ArrowLeft className="w-4 h-4 mr-1" /> Back</>}
            </Button>
            {isLast ? (
              <Button size="sm" onClick={finish}>Start recording <ArrowRight className="w-4 h-4 ml-1" /></Button>
            ) : (
              <Button size="sm" onClick={() => setStep(s => s + 1)} disabled={!canAdvance || practiceRecording}>
                {step === 0 ? 'Begin' : 'Next'} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}