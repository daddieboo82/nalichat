import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, ShieldCheck, Loader2 } from 'lucide-react';
import { runMobileStudioPreflight } from '@/lib/mobileStudioPreflight';

export default function MobileStudioPreflight({ disabled = false }) {
  const [working,setWorking] = useState(false);
  const [result,setResult] = useState(null);
  const controller = useRef(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const check = async () => {
    if (working || disabled) return;
    const current = new AbortController();
    controller.current = current;
    setWorking(true);
    setResult(null);
    try {
      const next = await runMobileStudioPreflight({signal:current.signal});
      if (!current.signal.aborted) setResult(next);
    } catch (error) {
      if (!current.signal.aborted) setResult({microphone:'unavailable',recordingEngine:'unavailable',
        storageLevel:'unknown',issues:[error?.message || 'Microphone check failed.']});
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setWorking(false);
      }
    }
  };
  return <section className="rounded-xl border border-foreground/10 bg-studio-raised p-3 space-y-2" aria-label="Mobile recording setup">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">Microphone readiness</h3>
        <p className="text-[11px] leading-4 text-muted-foreground">Optional check before recording. Your microphone audio is not saved or uploaded.</p>
      </div>
      <Button type="button" size="sm" variant="outline" className="min-h-11 shrink-0"
        disabled={working || disabled} onClick={check} aria-label="Check microphone readiness">
        {working ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-1 h-4 w-4"/>}
        {working?'Checking…':'Check'}
      </Button>
    </div>
    {result && <div role="status" aria-live="polite" className="space-y-1 text-xs">
      <p className="font-medium"><Mic className="inline h-4 w-4 mr-1"/>
        {result.microphone === 'ready' ? 'Microphone connected' : 'Microphone check needs attention'}
      </p>
      <p className="text-muted-foreground">
        Recording: {result.recordingEngine === 'lossless-wav' ? 'Lossless WAV available' :
          result.recordingEngine === 'browser-codec' ? 'Browser recording codec available' : 'Not confirmed'}
        {result.sampleRate ? ` · ${Math.round(result.sampleRate)} Hz` : ''}
      </p>
      <p className="text-muted-foreground">Device recovery storage: {result.storageLevel === 'ok' ? 'Estimated sufficient' :
        result.storageLevel === 'critical' ? 'Very low' : result.storageLevel === 'warning' ? 'Getting low' : 'Unknown'}</p>
      {result.issues?.map((issue,index)=><p key={index} className="text-amber-300">{issue}</p>)}
      <p className="text-[11px] text-muted-foreground">Tested locally. Use headphones, then arm a vocal track and press Record.</p>
    </div>}
  </section>;
}