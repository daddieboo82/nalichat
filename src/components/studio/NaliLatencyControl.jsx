import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { calibrateNaliStudioLatency } from '@/lib/naliLatencyCalibration';
import { readStudioLatencyProfile, saveStudioLatencyProfile } from '@/lib/naliLatencyEngine';
import { Clock3, Loader2 } from 'lucide-react';

// One-tap, optional local measurement. Never fabricates latency numbers.
// Saved for 24 hours on the *device*, not as a voice model or a cloud profile.
export default function NaliLatencyControl({ compact = false, disabled = false }) {
  const [profile, setProfile] = useState(() => readStudioLatencyProfile());
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  const calibrate = async () => {
    if (running) { controllerRef.current?.abort(); return; }
    if (disabled) return;
    if (!window.confirm('NaliChat will play three quiet sounds through your device speaker and listen with your microphone. Use the same audio output you record with. Do not use Bluetooth for this test. Continue?')) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setStatus('Preparing speaker and mic…');
    try {
      const result = await calibrateNaliStudioLatency({ onStatus: setStatus, signal: controller.signal });
      if (!result.valid) {
        setStatus('Calibration not reliable');
        toast.warning(result.reason || 'Could not measure device latency. No correction applied.');
        return;
      }
      if (!saveStudioLatencyProfile(result)) {
        toast.warning('Delay was measured, but this device cannot save calibration. No automatic correction will be applied.');
        return;
      }
      setProfile(result);
      setStatus('Calibrated');
      toast.success(`Measured microphone-to-speaker round trip: ${result.roundTripMs} ms (variation ${result.jitterMs} ms).`);
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus('Calibration canceled');
        toast.info('Calibration canceled. No correction applied.');
      } else {
        setStatus('Calibration unavailable');
        toast.error(error?.message || 'Could not calibrate latency on this device.');
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setRunning(false);
    }
  };
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <Button type="button" size="sm" variant="outline" disabled={disabled && !running}
        title="Measure local microphone and speaker delay. A reliable calibration helps align remote takes; it does not measure internet latency."
        aria-label="Calibrate microphone and speaker latency" onClick={calibrate}
        className="gap-1.5 rounded-xl">
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock3 className="w-3.5 h-3.5" />}
        {running ? 'Cancel Test' : compact ? 'Check Delay' : 'Calibrate Delay'}
      </Button>
      {!running && profile && <span className="text-[10px] text-muted-foreground" role="status">Measured {profile.roundTripMs} ms</span>}
      {running && <span className="text-[10px] text-muted-foreground" role="status">{status}</span>}
    </div>
  );
}
