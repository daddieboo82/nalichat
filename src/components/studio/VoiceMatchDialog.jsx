import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteVoiceProfile, generateVoiceMatch, getVoiceMatchModes, prepareVoiceAudio, readVoiceProfiles, saveVoiceProfile } from '@/lib/voxVoiceMatch';

export default function VoiceMatchDialog({ owner, take, onClose, onAdd }) {
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [reference, setReference] = useState(null);
  const [mode, setMode] = useState(take?.audioUrl ? 'enhance' : 'speech');
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState('');
  const [providerModes, setProviderModes] = useState(null);
  const [providerError, setProviderError] = useState('');
  const [providerCheck, setProviderCheck] = useState(0);
  const [jobStatus, setJobStatus] = useState('');
  const generation = useRef(null);
  const profile = profiles.find(item => item.id === selected);

  useEffect(() => () => generation.current?.abort(), []);

  useEffect(() => {
    let active = true;
    setProviderModes(null);
    setProviderError('');
    getVoiceMatchModes().then(modes => {
      if (active) setProviderModes(modes);
    }).catch(error => {
      if (active) setProviderError(error.message || 'Voice Match provider is unavailable.');
    });
    return () => { active = false; };
  }, [owner, providerCheck]);

  useEffect(() => {
    let active = true;
    readVoiceProfiles(owner).then(items => {
      if (!active) return;
      setProfiles(items);
      setSelected(items[0]?.id || '');
    }).catch(() => { if (active) setError('Could not load voice profiles on this device.'); });
    return () => { active = false; };
  }, [owner]);

  useEffect(() => {
    if (!result) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(result.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  const perform = async (action) => {
    setBusy(true);
    setError('');
    try { await action(); }
    catch (failure) { if (failure.name !== 'AbortError') setError(failure.message || 'Could not complete this action.'); }
    finally { setBusy(false); }
  };

  const save = () => perform(async () => {
    const wav = await prepareVoiceAudio(reference);
    const item = { owner, id: crypto.randomUUID(), name: name.trim(), wav };
    await saveVoiceProfile(item);
    setProfiles(current => [...current, item]);
    setSelected(item.id);
    setName('');
    setReference(null);
    setResult(null);
  });

  const remove = () => perform(async () => {
    await deleteVoiceProfile(owner, selected);
    setProfiles(current => current.filter(item => item.id !== selected));
    setSelected('');
    setResult(null);
  });

  const generate = () => perform(async () => {
    setResult(null);
    setJobStatus('preparing');
    const controller = new AbortController();
    generation.current = controller;
    try {
      const audio = await generateVoiceMatch({ profile, mode, text, track: take, signal: controller.signal, onStatus: setJobStatus });
      controller.signal.throwIfAborted();
      setResult({ ...audio, name: mode === 'enhance' ? `${take.name} (Vocal Polish)` : `${profile.name} (Voice Match)`, startTime: mode === 'speech' ? 0 : take.startTime });
    } finally {
      generation.current = null;
      setJobStatus('');
    }
  });

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>VoxShift Vocal Studio</DialogTitle>
          <DialogDescription>Polish your own recorded vocal, match an authorized reference voice, or generate spoken words. Voice profiles are saved in this browser.</DialogDescription>
        </DialogHeader>
        {providerError ? (
          <div className="flex items-center justify-between gap-2">
            <p role="status" className="text-sm text-muted-foreground">Local Vocal Polish is available. AI voice modes need a connected provider. {providerError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setProviderCheck(attempt => attempt + 1)}>Check again</Button>
          </div>
        ) : !providerModes && <p role="status" className="text-sm text-muted-foreground">Local Vocal Polish is available. Checking AI voice modes…</p>}
        {mode !== 'enhance' && providerModes && !providerModes.includes(mode) && <p role="status" className="text-sm text-muted-foreground">This generation mode is unavailable on the connected provider.</p>}
        <fieldset disabled={busy} className="space-y-4">
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
            I own or have permission to process this recording and any reference voice.
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 text-sm">
              Saved voice
              <select className="mt-1 block w-full rounded border bg-background p-2" value={selected} onChange={event => { setSelected(event.target.value); setReference(null); setResult(null); }}>
                <option value="">Select voice</option>
                {profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <Button type="button" variant="outline" disabled={!profile} onClick={remove}>Remove voice</Button>
          </div>
          <details className="rounded border p-3">
            <summary className="cursor-pointer text-sm font-medium">Add a reference voice</summary>
            <label className="mt-2 block text-sm">
              Voice name
              <input className="mt-1 block w-full rounded border bg-background p-2" maxLength={60} value={name} onChange={event => setName(event.target.value)} />
            </label>
            <label className="mt-2 block text-sm">
              Reference recording (3–30 seconds)
              <input className="mt-1 block w-full text-sm" type="file" accept="audio/*,.wav,.m4a,.mp3" key={selected} onChange={event => setReference(event.target.files?.[0] || null)} />
            </label>
            <Button className="mt-2" type="button" disabled={!consent || !reference || !name.trim()} onClick={save}>Save voice</Button>
          </details>
          <label className="block text-sm">
            Generation mode
            <select className="mt-1 block w-full rounded border bg-background p-2" value={mode} onChange={event => { setMode(event.target.value); setResult(null); }}>
              <option value="enhance" disabled={!take?.audioUrl}>Vocal Polish · keep my own voice</option>
              <option value="sing" disabled={!take?.audioUrl}>Singing · preserve melody (beta)</option>
              <option value="convert" disabled={!take?.audioUrl}>Convert spoken take</option>
              <option value="speech">Text to speech</option>
            </select>
          </label>
          {mode !== 'speech' ? (
            <p className="text-sm text-muted-foreground">Source: {take?.name} · 1–60 seconds of isolated vocal{mode === 'enhance' ? ' · processes locally in your browser, reduces rumble and evens levels' : ''}</p>
          ) : (
            <label className="block text-sm">
              Words to speak
              <textarea className="mt-1 block w-full rounded border bg-background p-2" rows={3} maxLength={400} value={text} onChange={event => { setText(event.target.value); setResult(null); }} />
            </label>
          )}
          <Button type="button" disabled={(mode !== 'enhance' && !providerModes?.includes(mode)) || (mode !== 'enhance' && !profile) || !consent || (mode === 'speech' ? !text.trim() : !take?.audioUrl)} onClick={generate}>
            Generate audio
          </Button>
          {result && preview && (
            <div className="space-y-2">
              <audio controls src={preview} className="w-full" aria-label="Generated voice preview" />
              <Button type="button" onClick={() => { if (onAdd(result)) onClose(); }}>Add to new track</Button>
            </div>
          )}
        </fieldset>
        {busy && (
          <div className="flex items-center gap-2">
            <p role="status" className="text-sm">
              {jobStatus === 'polishing' ? 'Polishing vocal in your browser…' : jobStatus === 'queued' ? 'Waiting for the voice model…' : jobStatus === 'running' ? 'Generating audio…' : 'Preparing audio…'}
            </p>
            {jobStatus && <Button type="button" variant="outline" onClick={onClose}>Close preview</Button>}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
