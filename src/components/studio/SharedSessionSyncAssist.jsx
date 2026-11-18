import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { analyzeSharedSessionTracks } from '@/lib/sessionSyncClient';
import { sessionTrackStart } from '@/lib/sessionTrackTiming';
import { toast } from 'sonner';

// Optional assist for overlapping takes that share an audible count-in,
// clap, or recorded guide. Never silently edits or time-stretches vocals.
export default function SharedSessionSyncAssist({ tracks, onTrackUpdate, canEdit }) {
  const playable = tracks.filter(t => t.audioUrl || t.file_url);
  const [referenceId, setReferenceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => { setResult(null); }, [referenceId, targetId, tracks]);

  if (!canEdit || playable.length < 2) return null;

  const reference = playable.find(t => String(t.id) === referenceId);
  const target = playable.find(t => String(t.id) === targetId);
  const compare = async () => {
    if (loading) { controllerRef.current?.abort(); return; }
    if (!reference || !target || referenceId === targetId) {
      toast.warning('Choose two different recordings that share a common audible guide.');
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setResult(null);
    try {
      const next = await analyzeSharedSessionTracks(reference, target, { signal: controller.signal });
      if (!controller.signal.aborted) setResult({ ...next, referenceId, targetId,
        originalStart: sessionTrackStart(target) });
    } catch (error) {
      if (!controller.signal.aborted) toast.error(error?.message || 'Could not compare these recordings.');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setLoading(false);
    }
  };
  const apply = async () => {
    if (!result?.valid || !target || result.targetId !== String(target.id) ||
        Math.abs(sessionTrackStart(target) - result.originalStart) > .001) {
      toast.warning('Track timing has changed. Run Sync Assist again.');
      return;
    }
    if (!window.confirm(`Move ${target.name || 'the selected track'} by ${Math.round(result.shiftSeconds * 1000)} ms? Only its saved start position changes; original audio stays untouched.`)) return;
    try {
      const changed = await onTrackUpdate(target.id, { start_time: result.suggestedStart });
      if (changed) {
        toast.success('Track aligned. Original recording preserved.');
        setResult(null);
      } else toast.error('Could not save the alignment. Try again.');
    } catch { toast.error('Could not save the alignment. Try again.'); }
  };
  return (
    <div className="border-b border-border/50 bg-secondary/20 px-3 py-2 text-xs space-y-2" aria-label="Shared Session Sync Assist">
      <div className="flex flex-wrap items-center gap-2">
        <strong>Sync Assist</strong>
        <select aria-label="Sync reference track" className="max-w-[140px] rounded border border-border bg-background p-1"
          value={referenceId} onChange={event => setReferenceId(event.target.value)}>
          <option value="">Reference track</option>
          {playable.map(t => <option key={t.id} value={String(t.id)}>{t.name || 'Track'}</option>)}
        </select>
        <select aria-label="Track to align" className="max-w-[140px] rounded border border-border bg-background p-1"
          value={targetId} onChange={event => setTargetId(event.target.value)}>
          <option value="">Track to align</option>
          {playable.filter(t => String(t.id) !== referenceId).map(t => <option key={t.id} value={String(t.id)}>{t.name || 'Track'}</option>)}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={compare}>
          {loading ? 'Cancel analysis' : 'Analyze Sync'}
        </Button>
        {result?.valid && <Button type="button" size="sm" onClick={apply}>Apply alignment</Button>}
      </div>
      {result ? (
        <p role="status" className={result.valid ? 'text-foreground' : 'text-muted-foreground'}>
          {result.valid
            ? `Matching cue found (${Math.round(result.confidence * 100)}% correlation). Proposed shift: ${Math.round(result.shiftSeconds * 1000)} ms; measured variation: ${result.driftMs} ms. Review before applying.`
            : result.reason}
        </p>
      ) : <p className="text-muted-foreground">Compare two recordings with the same audible clap, count-in or guide sound. Unrelated vocals cannot be auto-aligned reliably; source audio never changes.</p>}
    </div>
  );
}
