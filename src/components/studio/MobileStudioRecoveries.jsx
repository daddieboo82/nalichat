import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { listStudioRecoveryTakes, getStudioRecoveryTake, deleteStudioRecoveryTake } from '@/lib/studioTakeRecovery';

// The user explicitly chooses which completed take to restore. This list
// never reveals someone else's account or project recordings on shared phones.
export default function MobileStudioRecoveries({
  ownerId, scope, onRestore, disabled = false,
}) {
  const [rows, setRows] = useState([]);
  const [working, setWorking] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const refresh = async () => {
    if (!ownerId || !scope) { setRows([]); return; }
    try {
      const items = await listStudioRecoveryTakes(ownerId,scope);
      setRows(items);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
      setRows([]);
    }
  };
  useEffect(() => {
    let active = true;
    if (!ownerId || !scope) return undefined;
    listStudioRecoveryTakes(ownerId,scope).then(items => {
      if (active) {setRows(items);setUnavailable(false);}
    }).catch(() => {
      if (active) setUnavailable(true);
    });
    return () => {active = false;};
  },[ownerId,scope]);
  // A local take is written after recording finishes; force a refresh when
  // the existing screen receives an explicit "recording finalized" signal.
  useEffect(() => {
    const update = () => void refresh();
    window.addEventListener('nalichat:mobile-take-recovered',update);
    return () => window.removeEventListener('nalichat:mobile-take-recovered',update);
  });
  if (!ownerId || unavailable || rows.length === 0) return null;
  return <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2" aria-label="Device recording recovery">
    <p className="font-semibold text-sm">Recover recordings from this device</p>
    <p className="text-xs text-muted-foreground">Completed takes and available recording checkpoints are stored in this browser, not the NaliChat cloud. An interrupted take may be missing its last few seconds. Restore, listen, then Save for PC.</p>
    {rows.map(row => <div key={row.id} className="rounded-lg border border-white/10 p-2 space-y-2">
      <div className="text-xs font-medium truncate">{row.name || 'Recovered Vocal'} {row.partial ? '(Interrupted recording checkpoint)' : '(Completed backup)'}</div>
      <div className="text-[11px] text-muted-foreground">{new Date(row.createdAt).toLocaleString()} · {Math.ceil(row.bytes/1024)} KB · {Math.round(row.duration || 0)}s saved</div>
      <div className="flex gap-2">
        <Button size="sm" type="button" disabled={disabled || Boolean(working)}
          className="min-h-11 flex-1" onClick={async () => {
            setWorking(row.id);
            try {
              const stored = await getStudioRecoveryTake(ownerId,scope,row.id);
              await onRestore(stored);
              toast.success(stored.partial ? 'Interrupted take restored from last checkpoint. Listen before saving to the cloud.' : 'Recovered audio added as a new track. Save to keep it in the cloud.');
            } catch (error) { toast.error(error?.message || 'Could not recover this take.'); }
            finally { setWorking(null); }
          }}>Restore take</Button>
        <Button size="sm" variant="outline" type="button" disabled={disabled || Boolean(working)}
          className="min-h-11" onClick={async () => {
            if (!window.confirm('Permanently delete this device-only backup? Saved cloud projects will not be changed.')) return;
            setWorking(row.id);
            try { await deleteStudioRecoveryTake(ownerId,scope,row.id); await refresh(); }
            catch (error) { toast.error(error?.message || 'Could not delete recovery backup.'); }
            finally {setWorking(null);}
          }}>Delete backup</Button>
      </div>
    </div>)}
  </div>;
}
