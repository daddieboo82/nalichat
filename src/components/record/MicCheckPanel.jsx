import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, ShieldCheck, AlertCircle, Activity, Loader2, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/responsive-select';
import { Button } from '@/components/ui/button';
import { useMicMonitor } from '@/hooks/useMicMonitor';
import { cn } from '@/lib/utils';

/**
 * Pre-flight mic check: permission status, device selection, and a live input
 * level meter so users can SEE their mic is working before they hit record.
 *
 * Props:
 *  - devices: array of audioinput MediaDeviceInfo
 *  - selectedDevice: deviceId string
 *  - onSelectDevice: (deviceId) => void
 *  - recording: boolean — pause monitoring while the recorder owns the mic
 */
export default function MicCheckPanel({ devices = [], selectedDevice, onSelectDevice, recording = false }) {
  const { permission, level, monitoring, error, start, stop } = useMicMonitor();
  const [noSignalSince, setNoSignalSince] = useState(null);
  const startedRef = useRef(false);

  // Auto-start monitoring when permission is already granted and not recording.
  useEffect(() => {
    if (recording) { stop(); return; }
    if (permission === 'granted' && !monitoring) {
      start(selectedDevice);
      startedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, permission]);

  // Restart monitor when the selected device changes.
  useEffect(() => {
    if (recording) return;
    if (permission === 'granted' || permission === 'unknown') {
      stop();
      start(selectedDevice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice]);

  // Track sustained silence for the "no audio detected" hint.
  useEffect(() => {
    if (!monitoring) { setNoSignalSince(null); return; }
    if (level > 0.01) setNoSignalSince(null);
    else if (noSignalSince === null) setNoSignalSince(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, monitoring]);

  const silenceMs = noSignalSince ? Date.now() - noSignalSince : 0;
  const noSignal = monitoring && silenceMs > 6000 && level < 0.01;

  const levelPct = Math.min(100, Math.max(0, level * 100));
  const meterColor = level > 0.9 ? 'bg-red-500' : level > 0.05 ? 'bg-emerald-500' : level > 0.01 ? 'bg-yellow-500' : 'bg-muted';

  let hint = null;
  if (recording) {
    hint = { tone: 'muted', text: 'Monitoring paused while recording — tips appear below the visualizer.' };
  } else if (error) {
    hint = { tone: 'error', text: error };
  } else if (permission === 'denied') {
    hint = { tone: 'error', text: 'Microphone access is blocked. Click below, then allow access in your browser.' };
  } else if (!monitoring) {
    hint = { tone: 'muted', text: 'Tap "Check microphone" to test your mic and see live levels.' };
  } else if (noSignal) {
    hint = { tone: 'warn', text: 'No audio detected — check your mic is connected, unmuted, and selected above.' };
  } else if (level > 0.9) {
    hint = { tone: 'warn', text: 'Levels are hot — move back from the mic or lower your input gain to avoid clipping.' };
  } else if (level < 0.04 && level > 0.01) {
    hint = { tone: 'quiet', text: "You're a bit quiet — try moving closer to the mic." };
  } else if (level >= 0.04) {
    hint = { tone: 'good', text: 'Levels look great — you\u2019re ready to record!' };
  } else {
    hint = { tone: 'muted', text: 'Make some noise to test your mic…' };
  }

  const hintStyles = {
    muted: 'text-muted-foreground',
    error: 'text-destructive',
    warn: 'text-amber-400',
    quiet: 'text-sky-400',
    good: 'text-emerald-400',
  };

  return (
    <div className="w-full max-w-md mx-auto bg-card/50 backdrop-blur-xl rounded-2xl border border-white/[0.06] p-5 space-y-4">
      {/* Status row */}
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
          permission === 'granted' && !error ? 'bg-emerald-500/15 text-emerald-400' :
          permission === 'denied' ? 'bg-destructive/15 text-destructive' :
          'bg-secondary text-muted-foreground'
        )}>
          {permission === 'granted' && !error ? <ShieldCheck className="w-4.5 h-4.5" /> :
           permission === 'denied' ? <MicOff className="w-4.5 h-4.5" /> :
           <Mic className="w-4.5 h-4.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">
            {recording ? 'Recording in progress' :
             permission === 'granted' && !error ? 'Microphone ready' :
             permission === 'denied' ? 'Microphone blocked' :
             error ? 'Microphone issue' :
             'Microphone check'}
          </p>
          <p className={cn('text-xs leading-tight mt-0.5', hintStyles[hint.tone])}>{hint.text}</p>
        </div>
        {permission === 'granted' && !recording && !error && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg shrink-0"
            onClick={() => { stop(); start(selectedDevice); }}
            title="Re-check microphone"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Permission CTA */}
      {permission !== 'granted' && !error && (
        <Button
          className="w-full h-11 font-medium"
          onClick={() => start(selectedDevice)}
          disabled={recording}
        >
          {permission === 'denied' ? (
            <>
              <Mic className="w-4 h-4 mr-2" /> Allow microphone access
            </>
          ) : (
            <>
              <Activity className="w-4 h-4 mr-2" /> Check microphone
            </>
          )}
        </Button>
      )}
      {permission === 'denied' && (
        <p className="text-[11px] text-muted-foreground -mt-1">
          After clicking, choose "Allow" in the browser prompt. If you previously blocked it,
          you may need to update site permissions in your browser settings.
        </p>
      )}

      {/* Device select */}
      {devices.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Mic className="w-3.5 h-3.5" /> Input device
          </label>
          <Select value={selectedDevice || 'default'} onValueChange={onSelectDevice} disabled={recording}>
            <SelectTrigger className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm h-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default mic</SelectItem>
              {devices.map((device, idx) => {
                const deviceId = device.deviceId || `input-${idx}`;
                return (
                  <SelectItem key={deviceId} value={deviceId}>
                    {device.label || `Microphone ${idx + 1}`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Live level meter */}
      <AnimatePresence>
        {monitoring && !recording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Input level</span>
              <span className="font-mono">{levelPct.toFixed(0)}%</span>
            </div>
            <div className="relative h-3 rounded-full bg-secondary overflow-hidden border border-border/50">
              <div className="absolute inset-y-0 left-0 w-full opacity-30">
                <div className="absolute inset-y-0 left-0 bg-emerald-500/40" style={{ width: '40%' }} />
                <div className="absolute inset-y-0 bg-yellow-500/40" style={{ left: '40%', width: '50%' }} />
                <div className="absolute inset-y-0 right-0 bg-red-500/40" style={{ width: '10%' }} />
              </div>
              <motion.div
                className={cn('h-full rounded-full transition-colors', meterColor)}
                animate={{ width: `${levelPct}%` }}
                transition={{ duration: 0.05 }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Aim for the green zone when you speak normally.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}