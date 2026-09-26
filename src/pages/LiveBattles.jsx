import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Camera, Mic, Music2, Trophy, Users, Volume2, AlertCircle } from 'lucide-react';

const themes = {
  neon: 'from-fuchsia-700/40 via-purple-950 to-slate-950',
  gold: 'from-amber-600/40 via-stone-950 to-slate-950',
  ice: 'from-cyan-600/40 via-blue-950 to-slate-950',
};
const supported = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/flac'];

export default function LiveBattles() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [draftError, setDraftError] = useState('');
  const [category, setCategory] = useState('rap');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedDraft, setSavedDraft] = useState('');
  const [theme, setTheme] = useState('neon');
  const [track, setTrack] = useState(null);
  const [trackUrl, setTrackUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [preview, setPreview] = useState(false);
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);
  useEffect(() => {
    let active = true;
    if (!user?.id) return undefined;
    base44.entities.LiveBattle.filter({ creator_id: user.id }, '-created_date', 30)
      .then(rows => { if (active) setDrafts(rows.filter(row => row.status === 'draft')); })
      .catch(() => { if (active) setDraftError('Could not load your saved battle drafts.'); });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => () => { if (trackUrl) URL.revokeObjectURL(trackUrl); }, [trackUrl]);
  useEffect(() => { if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current; }, [preview]);

  async function startPreview() {
    setMediaError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('Camera preview requires a secure connection and a supported browser.');
      return;
    }
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: { echoCancellation: true } });
      streamRef.current = stream;
      setPreview(true);
      setMuted(false);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (error) {
      setMediaError(error?.name === 'NotAllowedError' ? 'Camera or microphone permission was denied. Check your browser permissions and try again.' : 'Could not open your camera and microphone. Check that another app is not using them.');
    }
  }
  function stopPreview() {
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
  async function saveDraft() {
    if (!consent || !track || !title.trim() || saving) return;
    setSaving(true);
    setMediaError('');
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('category', category);
      form.append('rights_confirmed', 'true');
      form.append('file', track);
      const response = await base44.functions.invoke('createBattleDraft', form);
      if (response?.data?.success !== true || !response?.data?.battleId) throw new Error(response?.data?.error || 'Saving draft failed.');
      setSavedDraft(response.data.battleId);
      const rows = await base44.entities.LiveBattle.filter({ creator_id: user.id }, '-created_date', 30);
      setDrafts(rows.filter(row => row.status === 'draft'));
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
  }

  return <div className="h-full overflow-y-auto bg-slate-950 text-white">
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[.3em] text-fuchsia-300">NaliChat presents</p><h1 className="text-3xl font-black sm:text-5xl">Live Battles</h1><p className="mt-2 text-slate-300">Rap or sing. Bring your track. Own the stage.</p></div>
        <Link to="/explore" className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Back to Explore</Link>
      </div>
      <div role="status" className="mt-6 flex gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100"><AlertCircle className="h-5 w-5 shrink-0" /><span>Test your camera locally, upload a track, then invite another artist from the battle lobby. Audience voting opens after both performers join the live room. Camera preview stays on this device.</span></div>
      <section aria-label="Battle stage preview" className={`relative mt-6 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br ${themes[theme]} p-4 shadow-2xl sm:p-8`}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 20%, #fff 0, transparent 42%)' }} />
        <div className="relative">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-widest"><span className="rounded-full bg-white/15 px-3 py-2">Stage preview · {category}</span><span className="rounded-full bg-black/40 px-3 py-2">No live audience yet</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-fuchsia-400/50 bg-black/60">
              {preview ? <video ref={videoRef} autoPlay muted playsInline aria-label="Your local camera preview" className="h-full w-full object-cover -scale-x-100" /> : <div className="text-center"><Camera className="mx-auto mb-2 h-10 w-10 text-fuchsia-300" /><span>Your camera</span></div>}
            </div>
            <div className="flex aspect-video items-center justify-center rounded-2xl border border-white/20 bg-black/60 text-center text-slate-300"><div><Mic className="mx-auto mb-2 h-10 w-10" />Opponent stage<br /><span className="text-xs">Available when live rooms launch</span></div></div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm"><div className="rounded-xl bg-black/30 p-3">Round countdown<br /><strong>Coming soon</strong></div><div className="rounded-xl bg-black/30 p-3">Crowd energy<br /><strong>Awaiting audience</strong></div><div className="rounded-xl bg-black/30 p-3">Score reveal<br /><strong>No result yet</strong></div></div>
        </div>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-white/5 p-5"><h2 className="text-xl font-bold">Set up your performance</h2>
          <label className="mt-4 block text-sm">Battle title<input value={title} maxLength={100} onChange={e => setTitle(e.target.value)} placeholder="Name your battle" className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 p-3" /></label>
          <label className="mt-4 block text-sm">Battle style<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 p-3"><option value="rap">Rap battle</option><option value="singing">Singing battle</option></select></label>
          <label className="mt-4 block text-sm">Stage look<select value={theme} onChange={e => setTheme(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 p-3"><option value="neon">Neon</option><option value="gold">Gold</option><option value="ice">Ice</option></select></label>
          <label className="mt-4 block text-sm">Battle track · audio under 50 MB<input type="file" accept=".mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*" onChange={chooseTrack} className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-500 file:px-4 file:py-2 file:font-bold file:text-white" /></label>
          <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />I own this track or have permission to use it in a public performance.</label>
          {track && <div className="mt-4 rounded-xl bg-black/30 p-3"><p className="mb-2 truncate text-sm"><Music2 className="mr-2 inline h-4 w-4" />{track.name} · local preview only</p><audio controls src={trackUrl} className="w-full" aria-label="Preview selected battle track" /><button type="button" onClick={() => { setTrack(null); setTrackUrl(''); }} className="mt-2 text-xs underline">Remove track</button></div>}
          <button type="button" onClick={saveDraft} disabled={!title.trim() || !track || !consent || saving || Boolean(savedDraft)} className="mt-4 min-h-11 rounded-xl bg-fuchsia-600 px-4 font-bold disabled:opacity-50">{saving ? 'Uploading track…' : savedDraft ? 'Draft saved' : 'Save battle and upload track'}</button>
          {savedDraft && <div role="status" className="mt-2 text-sm text-emerald-300">Battle draft saved. <Link className="underline" to="/battles/lobby">Open the lobby</Link> to invite an artist. <button type="button" onClick={() => { setSavedDraft(''); setTitle(''); setTrack(null); setTrackUrl(''); setConsent(false); }} className="ml-2 underline">Create another battle</button></div>}
          <p className="mt-3 text-xs text-slate-400">A saved track is stored with your battle draft. Avoid playing a track on speakers during camera preview to prevent feedback.</p>
        </section>
        <section className="rounded-2xl border border-white/15 bg-white/5 p-5"><h2 className="text-xl font-bold">Camera and accessibility</h2><p className="mt-2 text-sm text-slate-300">Check your setup before stepping on stage. Preview stays on your device.</p>
          <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={preview ? stopPreview : startPreview} className="min-h-11 rounded-xl bg-fuchsia-600 px-4 font-bold hover:bg-fuchsia-500">{preview ? 'Stop camera preview' : 'Test camera and microphone'}</button>{preview && <button type="button" onClick={toggleMic} className="min-h-11 rounded-xl border border-white/30 px-4">{muted ? 'Unmute microphone' : 'Mute microphone'}</button>}</div>
          {mediaError && <p role="alert" className="mt-3 text-sm text-rose-300">{mediaError}</p>}
          <label className="mt-5 flex items-center gap-3 text-sm"><input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} />Reduce stage motion</label>
          <p className="mt-3 text-xs text-slate-400">Theme: {theme}. {reducedMotion ? 'Reduced motion enabled.' : 'Stage effects will respect your device settings.'}</p>
          <Link to="/battles/lobby" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-fuchsia-600 font-bold hover:bg-fuchsia-500">Open battle lobby</Link>
        </section>
      </div>
      <section className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-5" aria-label="Your saved battle drafts"><h2 className="text-xl font-bold">Your saved battle drafts</h2>{draftError && <p role="alert" className="mt-2 text-rose-300">{draftError}</p>}{drafts.length === 0 && <p className="mt-2 text-sm text-slate-400">No saved drafts yet.</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2">{drafts.map(draft => <article key={draft.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="font-bold">{draft.title}</p><p className="mb-2 text-xs capitalize text-slate-400">{draft.category} · Draft</p>{draft.creator_track_url && <audio controls src={draft.creator_track_url} className="w-full" aria-label={`Play ${draft.creator_track_name || draft.title}`} />}</article>)}</div></section>
      <section className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/10 p-4"><Users className="mb-2 text-fuchsia-300" /><strong>Live audience</strong><p className="text-sm text-slate-400">Watch and react when rooms launch.</p></div><div className="rounded-xl border border-white/10 p-4"><Volume2 className="mb-2 text-fuchsia-300" /><strong>Fair voting</strong><p className="text-sm text-slate-400">One verified audience vote per battle.</p></div><div className="rounded-xl border border-white/10 p-4"><Trophy className="mb-2 text-fuchsia-300" /><strong>Artist awards</strong><p className="text-sm text-slate-400">Best Rapper and Best Singer will reflect completed battles.</p></div></section>
      {!consent && track && <p className="mt-3 text-xs text-amber-300">Confirm track rights before a future public performance.</p>}
    </div>
  </div>;
}