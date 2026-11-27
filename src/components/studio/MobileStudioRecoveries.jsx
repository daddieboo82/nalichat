import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { listStudioRecoveryTakes, getStudioRecoveryTake, deleteStudioRecoveryTake } from '@/lib/studioTakeRecovery';
import { listStudioPcmSessions, openStudioPcmSpool } from '@/lib/studioPcmSpool';
import { studioRecoveryStorageHealth } from '@/lib/studioRecoveryStorageHealth';

// The user explicitly chooses which completed take to restore. This list
// never reveals someone else's account or project recordings on shared phones.
export default function MobileStudioRecoveries({
  ownerId, scope, onRestore, disabled = false,
}) {
  const [rows, setRows] = useState([]);
  const context = useRef(null);
  const generation = useRef(0);
  const key = JSON.stringify([ownerId,scope]);
  context.current = {key, disabled};
  const [loadedKey,setLoadedKey] = useState(null);
  const visibleRows = loadedKey === key ? rows : [];
  const validAction = () => context.current.key === key && !context.current.disabled;
  const loadRows = async () => {
    const completed = await listStudioRecoveryTakes(ownerId,scope);
    // Experimental PCM recovery is independent of completed-take backups.
    const sessions = await listStudioPcmSessions(ownerId,scope).catch(() => []);
    return [...completed,...sessions.map(session => ({
      ...session, id:'pcm:'+session.sessionId, name:'Interrupted PCM take',
      createdAt:session.updatedAt, duration:session.bytes/(session.sampleRate*2),
      partial:true, pcm:true,
    }))];
  };
  const withPcm = async (row, action) => {
    const spool = await openStudioPcmSpool(row.sessionId,{ownerId,scope,sampleRate:row.sampleRate,recoveryOnly:true});
    try { return await action(spool); }
    finally { await spool.close(); }
  };
  const [working, setWorking] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [storageHealth, setStorageHealth] = useState(null);
  const refresh = async () => {
    if (!ownerId || !scope) { setRows([]); return; }
    const request = ++generation.current;
    const current = () => context.current.key === key && generation.current === request;
    void studioRecoveryStorageHealth().then(health => { if (current()) setStorageHealth(health); });
    try {
      const items = await loadRows();
      if (current()) { setRows(items); setLoadedKey(key); setUnavailable(false); }
    } catch {
      if (current()) { setUnavailable(true); setRows([]); }
    }
  };
  useEffect(() => {
    let active = true;
    const request = ++generation.current;
    const current = () => active && context.current.key === key && generation.current === request;
    if (!ownerId || !scope) return undefined;
    void studioRecoveryStorageHealth().then(health => {
      if (current()) setStorageHealth(health);
    });
    setRows([]);
    loadRows().then(items => {
      if (current()) {setRows(items);setLoadedKey(key);setUnavailable(false);}
    }).catch(() => {
      if (current()) setUnavailable(true);
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
  if (!ownerId) return null;
  const lowStorage = storageHealth?.supported && ['critical','warning'].includes(storageHealth.level);
  if (!lowStorage && (unavailable || visibleRows.length === 0)) return null;
  return <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2" aria-label="Device recording recovery">
    <p className="font-semibold text-sm">Device recording protection</p>
    {lowStorage && <div role="alert" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-200">
      <p className="font-semibold">{storageHealth.level === 'critical' ? 'Very low browser storage' : 'Browser storage is getting low'}</p>
      <p className="mt-1">{storageHealth.detail} Your existing recordings are not automatically deleted.</p>
    </div>}
    {visibleRows.length > 0 && <p className="text-xs text-muted-foreground">Completed takes and recording checkpoints are stored on this device, not the NaliChat cloud. Interrupted takes may be missing their last seconds. Restore, listen, then Save for PC.</p>}
    {visibleRows.map(row => <div key={row.id} className="rounded-lg border border-white/10 p-2 space-y-2">
      <div className="text-xs font-medium truncate">{row.name || 'Recovered Vocal'} {row.partial ? '(Interrupted recording checkpoint)' : '(Completed backup)'}</div>
      <div className="text-[11px] text-muted-foreground">{new Date(row.createdAt).toLocaleString()} · {Math.ceil(row.bytes/1024)} KB · {Math.round(row.duration || 0)}s saved</div>
      <div className="flex gap-2">
        <Button size="sm" type="button" disabled={disabled || Boolean(working)}
          className="min-h-11 flex-1" onClick={async () => {
            if (!validAction()) return;
            setWorking(row.id);
            try {
              const stored = row.pcm ? await withPcm(row, async spool => ({...row,...await spool.assembleWav(row.sampleRate)})) : await getStudioRecoveryTake(ownerId,scope,row.id);
              if (!validAction()) throw new Error('Project or recording state changed; try again.');
              await onRestore(stored);
              toast.success(stored.partial ? 'Interrupted take restored from last checkpoint. Listen before saving to the cloud.' : 'Recovered audio added as a new track. Save to keep it in the cloud.');
            } catch (error) { toast.error(error?.message || 'Could not recover this take.'); }
            finally { setWorking(null); }
          }}>Restore take</Button>
        <Button size="sm" variant="outline" type="button" disabled={disabled || Boolean(working)}
          className="min-h-11" onClick={async () => {
            if (!window.confirm('Permanently delete this device-only backup? Saved cloud projects will not be changed.')) return;
            setWorking(row.id);
            try { if (row.pcm) await withPcm(row, spool => { if (!validAction()) throw new Error('Project or recording state changed; try again.'); return spool.remove(); }); else await deleteStudioRecoveryTake(ownerId,scope,row.id); await refresh(); }
            catch (error) { toast.error(error?.message || 'Could not delete recovery backup.'); }
            finally {setWorking(null);}
          }}>Delete backup</Button>
      </div>
    </div>)}
  </div>;
}
