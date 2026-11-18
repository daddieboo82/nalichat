import { useState } from 'react';
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
  const calibrate = async () => {
    if (running || disabled) return;
    if (!window.confirm('NaliChat will play three quiet sounds through your device speaker and listen with your microphone. Use the same audio output you record with. Do not use Bluetooth for this test. Continue?')) return;
    setRunning(true);
    setStatus('Preparing speaker and mic…');
    try {
      const result = await calibrateNaliStudioLatency({ onStatus: setStatus });
      if (!result.valid) {
        setStatus('Calibration not reliable');
        toast.warning(result.reason || 'Could not measure device latency. No correction applied.');
        return;
      }
      saveStudioLatencyProfile(result);
      setProfile(result);
      setStatus('Calibrated');
      toast.success(`Measured microphone-to-speaker round trip: ${result.roundTripMs} ms (variation ${result.jitterMs} ms).`);
    } catch (error) {
      setStatus('Calibration unavailable');
      toast.error(error?.message || 'Could not calibrate latency on this device.');
    } finally {
      setRunning(false);
    }
  };
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <Button type="button" size="sm" variant="outline" disabled={running || disabled}
        title="Measure local microphone and speaker delay. A reliable calibration helps align remote takes; it does not measure internet latency."
        aria-label="Calibrate microphone and speaker latency" onClick={calibrate}
        className="gap-1.5 rounded-xl">
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock3 className="w-3.5 h-3.5" />}
        {running ? 'Calibrating…' : compact ? 'Fix Delay' : 'Calibrate Delay'}
      </Button>
      {!running && profile && <span className="text-[10px] text-muted-foreground" role="status">Measured {profile.roundTripMs} ms</span>}
      {running && <span className="text-[10px] text-muted-foreground" role="status">{status}</span>}
    </div>
  );
}
