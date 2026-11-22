import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Camera, Music2 } from 'lucide-react';

const supported = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/flac'];

export default function LiveBattles() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('rap');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState('neon');
  const [track, setTrack] = useState(null);
  const [trackUrl, setTrackUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [preview, setPreview] = useState(false);
  const [muted, setMuted] = useState(false);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  const mediaRequest = useRef(0);
  const [cameraPending, setCameraPending] = useState(false);
  useEffect(() => () => {
    mediaRequest.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);
  useEffect(() => () => { if (trackUrl) URL.revokeObjectURL(trackUrl); }, [trackUrl]);
  useEffect(() => { if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current; }, [preview]);

  async function startPreview() {
    setMediaError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('Camera preview requires a secure connection and a supported browser.');
      return;
    }
    const request = ++mediaRequest.current;
    setCameraPending(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: { echoCancellation: true } });
      if (request !== mediaRequest.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setPreview(true);
      setMuted(false);
    } catch (error) {
      if (request === mediaRequest.current) {
        setMediaError(error?.name === 'NotAllowedError' ? 'Camera or microphone permission was denied. Check your browser permissions and try again.' : 'Could not open your camera and microphone. Check that another app is not using them.');
      }
    } finally {
      if (request === mediaRequest.current) setCameraPending(false);
    }
  }
  function stopPreview() {
    mediaRequest.current += 1;
    setCameraPending(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPreview(false);
  }
  function toggleMic() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
    setMuted(next);
  }
  async function saveDraft(event) {
    event.preventDefault();
    if (!consent || !track || !title.trim() || saving) return;
    setSaving(true);
    setMediaError('');
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('category', category);
      form.append('stage_theme', theme);
      form.append('rights_confirmed', 'true');
      form.append('file', track);
      const response = await base44.functions.invoke('createBattleDraft', form);
      if (response?.data?.success !== true || !response?.data?.battleId) throw new Error(response?.data?.error || 'Saving draft failed.');
      navigate('/battles?draft=' + encodeURIComponent(response.data.battleId), { replace: true });
    } catch (error) { setMediaError(error?.response?.data?.error || error?.message || 'Saving draft failed.'); }
    finally { setSaving(false); }
  }
  function chooseTrack(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!supported.includes(file.type) || file.size > 50 * 1024 * 1024) {
      setMediaError('Select an MP3, M4A, WAV, WebM, OGG or FLAC audio file under 50 MB.');
      event.target.value = '';
      return;
    }
    if (trackUrl) URL.revokeObjectURL(trackUrl);
    setMediaError('');
    setTrack(file);
    setTrackUrl(URL.createObjectURL(file));
    event.target.value = '';
  }

  return (
    <main className="nali-workspace h-full overflow-y-auto bg-background px-4 pt-5 pb-24 text-foreground">
      <div className="mx-auto max-w-xl space-y-4">
        <Link to="/battles" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">← Battle Arena</Link>
        <header>
          <h1 className="font-heading text-3xl font-black tracking-tight">Create a battle</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add your track, then invite an artist.</p>
        </header>
        <form onSubmit={saveDraft} className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <label className="block text-sm font-medium">Battle name
            <input required value={title} maxLength={100} onChange={e => setTitle(e.target.value)} placeholder="Name your battle" className="mt-1 block min-h-12 w-full rounded-xl border border-border bg-background px-3" />
          </label>
          <label className="block text-sm font-medium">Battle style
            <select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 block min-h-12 w-full rounded-xl border border-border bg-background px-3">
              <option value="rap">Rap battle</option>
              <option value="singing">Singing battle</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Battle track <span className="text-muted-foreground">(up to 50 MB)</span>
            <input type="file" accept=".mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*" onChange={chooseTrack} className="mt-1 block min-h-11 w-full text-sm file:mr-2 file:min-h-11 file:rounded-xl file:border-0 file:bg-secondary file:px-3 file:font-semibold file:text-foreground" />
          </label>
          {track && (
            <div className="space-y-2 rounded-xl border border-border bg-background p-3">
              <p className="flex min-w-0 items-center gap-2 text-sm"><Music2 className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{track.name}</span></p>
              <audio controls src={trackUrl} className="w-full" aria-label="Preview selected battle track" />
              <button type="button" className="min-h-11 text-sm underline" onClick={() => { setTrack(null); setTrackUrl(''); }}>Remove track</button>
            </div>
          )}
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="h-5 w-5 shrink-0 accent-primary" />
            I have permission to use this track in a public performance.
          </label>
          <details onToggle={event => { if (!event.currentTarget.open && (preview || cameraPending)) stopPreview(); }} className="rounded-xl border border-border px-3">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Stage look and camera check</summary>
            <div className="space-y-3 pb-3">
              <label className="block text-sm">Stage look
                <select value={theme} onChange={e => setTheme(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-background px-3">
                  <option value="neon">Neon</option><option value="gold">Gold</option><option value="ice">Ice</option>
                </select>
              </label>
              <p className="text-xs text-muted-foreground">Camera preview stays on this device.</p>
              {preview && <video ref={videoRef} autoPlay muted playsInline aria-label="Your local camera preview" className="aspect-video w-full rounded-xl bg-black object-cover -scale-x-100" />}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={cameraPending} onClick={preview ? stopPreview : startPreview} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm">
                  <Camera className="h-4 w-4" aria-hidden="true" /> {cameraPending ? 'Opening camera…' : preview ? 'Stop camera preview' : 'Test camera and microphone'}
                </button>
                {preview && <button type="button" onClick={toggleMic} className="min-h-11 rounded-xl border border-border px-3 text-sm">{muted ? 'Unmute microphone' : 'Mute microphone'}</button>}
              </div>
            </div>
          </details>
          {mediaError && <p role="alert" className="text-sm text-destructive">{mediaError}</p>}
          <button type="submit" disabled={!title.trim() || !track || !consent || saving} className="min-h-12 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? 'Uploading track…' : 'Save and invite an artist'}
          </button>
        </form>
      </div>
    </main>
  );
}
