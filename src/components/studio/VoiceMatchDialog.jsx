import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteVoiceProfile, generateVoiceMatch, getVoiceMatchModes, prepareVoiceAudio, readVoiceProfiles, saveVoiceProfile } from '@/lib/voxVoiceMatch';
import { checkLocalWebGPU } from '@/lib/voxWebGPU';
import { validateLocalRvcModels } from '@/lib/voxRvcLocal';
import { checkLocalRvcReadiness } from '@/lib/voxLocalReadiness';

export default function VoiceMatchDialog({ owner, take, onClose, onAdd, initialMode }) {
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [reference, setReference] = useState(null);
  const [mode, setMode] = useState(initialMode === 'nali-voice' && take?.audioUrl ? 'nali-voice' : take?.audioUrl ? 'enhance' : 'speech');
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState('');
  const [providerModes, setProviderModes] = useState(null);
  const [providerError, setProviderError] = useState('');
  const [providerCheck, setProviderCheck] = useState(0);
  const [gpuCheck, setGpuCheck] = useState(null);
  const [localModels, setLocalModels] = useState({ model: null, contentVec: null, rmvpe: null });
  const [modelPermission, setModelPermission] = useState(false);
  const [checkingGPU, setCheckingGPU] = useState(false);
  const [jobStatus, setJobStatus] = useState('');
  const generation = useRef(null);
  const profile = profiles.find(item => item.id === selected);
  const localModelError = mode === 'local-rvc' ? validateLocalRvcModels(localModels) : null;
  const localRvcReadiness = mode === 'local-rvc' ? checkLocalRvcReadiness() : null;

  useEffect(() => () => generation.current?.abort(), []);

  useEffect(() => {
    let active = true;
    setProviderModes(null);
    setProviderError('');
    // Never invoke a hosted AI backend while using either free local mode.
    if (mode === 'enhance' || mode === 'local-rvc' || mode === 'nali-voice') return () => { active = false; };
    getVoiceMatchModes().then(modes => {
      if (active) setProviderModes(modes);
    }).catch(error => {
      if (active) setProviderError(error.message || 'Voice Match provider is unavailable.');
    });
    return () => { active = false; };
  }, [owner, providerCheck, mode]);

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
      const audio = await generateVoiceMatch({ profile, mode, text, track: take, owner, signal: controller.signal, onStatus: setJobStatus, localModels });
      controller.signal.throwIfAborted();
      setResult({ ...audio, name: mode === 'enhance' ? `${take.name} (Vocal Polish)` : mode === 'nali-voice' ? `${take.name} (NaliVoice Research)` : mode === 'local-rvc' ? `${take.name} (RVC Voice)` : `${profile.name} (Voice Match)`, startTime: mode === 'speech' ? 0 : take.startTime });
    } finally {
      generation.current = null;
      setJobStatus('');
    }
  });

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg bg-studio-surface border-foreground/10">
        <DialogHeader>
          <DialogTitle>VoxShift Vocal Studio</DialogTitle>
          <DialogDescription>NaliVoice is a custom NaliBase neural audio research engine. No model files or paid AI services are needed. It does not yet provide full generative singing or voice cloning.</DialogDescription>
        </DialogHeader>
        {mode === 'enhance' && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Free Vocal Polish GPU readiness</p>
              <Button type="button" size="sm" variant="outline" disabled={checkingGPU} onClick={async () => {
                setCheckingGPU(true);
                try { setGpuCheck(await checkLocalWebGPU()); }
                finally { setCheckingGPU(false); }
              }}>{checkingGPU ? 'Checking…' : 'Check WebGPU'}</Button>
            </div>
            <p className="text-xs text-muted-foreground" role="status">{gpuCheck?.reason || 'WebGPU can accelerate the final level stage. Vocal Polish also works without WebGPU and never calls paid inference.'}</p>
          </div>
        )}
        {mode === 'local-rvc' && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">Free local AI browser compatibility</p>
            <p className="text-xs text-muted-foreground" role="status">{localRvcReadiness?.reason}</p>
          </div>
        )}
        {mode !== 'enhance' && mode !== 'local-rvc' && mode !== 'nali-voice' && (providerError ? (
          <div className="flex items-center justify-between gap-2">
            <p role="status" className="text-sm text-muted-foreground">Local Vocal Polish is available. AI voice modes need a connected provider. {providerError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setProviderCheck(attempt => attempt + 1)}>Check again</Button>
          </div>
        ) : !providerModes && <p role="status" className="text-sm text-muted-foreground">Checking hosted AI voice modes…</p>)}
        {mode !== 'enhance' && mode !== 'local-rvc' && mode !== 'nali-voice' && providerModes && !providerModes.includes(mode) && <p role="status" className="text-sm text-muted-foreground">This generation mode is unavailable on the connected provider.</p>}
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
              <option value="nali-voice" disabled={!take?.audioUrl}>NaliVoice · automatic neural restoration (research)</option>
              <option value="local-rvc" disabled={!take?.audioUrl}>Advanced RVC conversion · optional licensed model files</option>
              <option value="sing" disabled={!take?.audioUrl}>Singing · preserve melody (beta)</option>
              <option value="convert" disabled={!take?.audioUrl}>Convert spoken take</option>
              <option value="speech">Text to speech</option>
            </select>
          </label>
          {mode === 'nali-voice' && (
            <div className="rounded border p-3 space-y-2 text-sm">
              <p className="font-medium">NaliVoice · no model setup</p>
              <p className="text-xs text-muted-foreground">This first-party neural restoration prototype learns from the selected audio locally and creates a separate processed track. It is experimental, not a trained generative singer or a Suno-quality reconstruction engine. No file upload, voice model selection, or paid inference is necessary.</p>
            </div>
          )}
          {mode === 'local-rvc' && (
            <div className="rounded border p-3 space-y-2 text-sm">
              <p className="font-medium">Generative AI Vocal Reconstruction · Experimental</p>
              <p className="text-xs text-muted-foreground">Supply an authorized RVC v2 ONNX voice model, ContentVec ONNX, and RMVPE ONNX. Neural conversion currently runs using WebAssembly on your device's CPU (not WebGPU). Model files stay in this browser session. The browser downloads free ONNX runtime binaries when you generate. This may use significant memory and can be slow.</p>
              {[
                ['model', 'RVC v2 voice model (.onnx)'],
                ['contentVec', 'ContentVec feature model (.onnx)'],
                ['rmvpe', 'RMVPE pitch model (.onnx)'],
              ].map(([key, title]) => (
                <label key={key} className="block text-xs">
                  {title}
                  <input type="file" accept=".onnx" className="mt-1 block w-full" onChange={event => {
                    setLocalModels(current => ({ ...current, [key]: event.target.files?.[0] || null }));
                    setResult(null);
                  }} />
                </label>
              ))}
              <label className="flex gap-2 text-xs">
                <input type="checkbox" checked={modelPermission} onChange={event => setModelPermission(event.target.checked)} />
                I have permission to use these model weights, including for my intended use.
              </label>
              {localModelError && <p className="text-xs text-muted-foreground">{localModelError}</p>}
              <p className="text-xs text-muted-foreground">This option reconstructs vocal timbre using a pre-trained RVC model. It does not learn a new voice from one reference recording, repair all defects, or guarantee Suno-like results. It requires 1–20 seconds of source vocal audio and uses your browser CPU, without paid inference.</p>
            </div>
          )}
          {mode !== 'speech' ? (
            <p className="text-sm text-muted-foreground">Source: {take?.name} · 1–60 seconds of isolated vocal{mode === 'enhance' ? ' · processes locally in your browser, reduces rumble and evens levels' : ['local-rvc','nali-voice'].includes(mode) ? ' · select 1–20 seconds of isolated vocal' : ''}</p>
          ) : (
            <label className="block text-sm">
              Words to speak
              <textarea className="mt-1 block w-full rounded border bg-background p-2" rows={3} maxLength={400} value={text} onChange={event => { setText(event.target.value); setResult(null); }} />
            </label>
          )}
          <Button type="button" disabled={(!['enhance', 'local-rvc', 'nali-voice'].includes(mode) && !providerModes?.includes(mode)) || (!['enhance', 'local-rvc', 'nali-voice'].includes(mode) && !profile) || !consent || (mode === 'local-rvc' && (!localRvcReadiness?.supported || localModelError || !modelPermission)) || (mode === 'speech' ? !text.trim() : !take?.audioUrl)} onClick={generate}>
            Generate audio
          </Button>
          {result && preview && (
            <div className="space-y-2">
              <audio controls src={preview} className="w-full" aria-label="Generated voice preview" />
              {mode === 'enhance' && <p className="text-xs text-muted-foreground" role="status">Processed on this device using {result.processingBackend === 'webgpu' ? 'free WebGPU acceleration' : 'the browser CPU fallback'}. No paid inference credits used.</p>}
              {mode === 'local-rvc' && <p className="text-xs text-muted-foreground" role="status">Converted locally with WebAssembly (CPU). Your model files and audio were not uploaded to an inference server.</p>}
              {mode === 'nali-voice' && <p className="text-xs text-muted-foreground" role="status">Processed locally by the experimental NaliVoice neural restorer. No third-party voice model was used.</p>}
              <Button type="button" onClick={() => { if (onAdd(result)) onClose(); }}>Add to new track</Button>
            </div>
          )}
        </fieldset>
        {busy && (
          <div className="flex items-center gap-2">
            <p role="status" className="text-sm">
              {['local-rvc', 'nali-voice'].includes(mode) && jobStatus ? jobStatus : jobStatus === 'polishing' ? 'Polishing vocal in your browser…' : jobStatus === 'queued' ? 'Waiting for the voice model…' : jobStatus === 'running' ? 'Generating audio…' : 'Preparing audio…'}
            </p>
            {jobStatus && <Button type="button" variant="outline" onClick={() => generation.current?.abort()}>Cancel processing</Button>}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}