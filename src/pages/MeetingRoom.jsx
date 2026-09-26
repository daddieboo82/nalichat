import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LiveKitRoom, VideoConference, ConnectionState } from '@livekit/components-react';
import '@livekit/components-styles';
import './MeetingRoom.css';
import { base44 } from '@/api/base44Client';
import { Copy, Music2, Video, ShieldCheck } from 'lucide-react';

const message = e => e?.response?.data?.error || e?.message || 'Could not load this room.';
export default function MeetingRoom() {
  const { roomId } = useParams();
  const [params] = useSearchParams();
  const inviteCode = params.get('invite') || '';
  const [room, setRoom] = useState(null);
  const [host, setHost] = useState(false);
  const [session, setSession] = useState(null);
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useCallback((action, extra = {}) => base44.functions.invoke('meetingHub', { action, roomId, inviteCode, ...extra }), [roomId, inviteCode]);
  const refresh = useCallback(async () => {
    try {
      const { data } = await request('details');
      setRoom(data.room); setHost(data.host);
      if (data.host && !notesDirty) setNotes(data.room.notes || '');
      setError('');
      if (data.room.status === 'ended') setSession(null);
    } catch (e) { setError(message(e)); }
  }, [request, notesDirty]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 12000); return () => clearInterval(timer); }, [refresh]);
  async function act(action, extra = {}) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await request(action, extra);
      if (action === 'rotate') {
        setInvite(window.location.origin + '/meetings/' + roomId + '?invite=' + encodeURIComponent(data.inviteCode));
        setNotice('A new invitation is ready. Previous invitation links no longer work for new visitors.');
      } else if (action === 'notes') { setNotesDirty(false); setNotice('Private decision notes saved.'); }
      else { if (action === 'end') setSession(null); await refresh(); }
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function join() {
    if (busy || session) return;
    setBusy(true); setError('');
    try { const { data } = await request('join'); setSession(data); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  return <main className="min-h-full overflow-y-auto bg-slate-950 px-3 py-5 pb-28 text-white sm:px-6">
    <div className="mx-auto max-w-6xl">
      <Link to="/meetings" className="inline-flex min-h-11 items-center text-sm text-violet-300 hover:underline">← Meeting Hub</Link>
      <header className="mt-2 rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950 via-slate-950 to-cyan-950 p-5 sm:p-7">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-violet-300">{room?.kind === 'listening' ? <Music2 className="h-4 w-4" /> : <Video className="h-4 w-4" />}{room?.kind === 'listening' ? 'Listening party' : 'Business meeting'} · Private</p>
        <h1 className="mt-2 break-words text-2xl font-black sm:text-4xl">{room?.title || 'Opening meeting…'}</h1>
        {room && <p className="mt-2 text-sm text-slate-300">Hosted by {room.host_name} · {new Date(room.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · <span className="capitalize">{room.status}</span></p>}
        {room?.artist_name && <p className="mt-2 text-sm text-violet-200">Featured artist: {room.artist_name}</p>}
        {room?.agenda && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm text-slate-200">{room.agenda}</p>}
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/60 p-3 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-950/50 p-3 text-sm text-emerald-200">{notice}</p>}
      {!room && !error && <p className="mt-6 text-sm text-slate-300">Checking your invitation…</p>}
      {room && <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-5">
          {room.kind === 'listening' && <section className="rounded-2xl border border-violet-400/20 bg-violet-950/20 p-4" aria-label="Listening track">
            <h2 className="font-bold">Artist listening room</h2>
            {room.track_url ? <><p className="mt-1 text-xs text-slate-400">Each guest controls playback. For everyone to hear the same moment, share a browser tab with audio from a supported desktop browser.</p><audio controls preload="none" src={room.track_url} className="mt-4 w-full" /></> : <p className="mt-2 text-sm text-slate-300">Use the meeting screen share control to present the artist’s music. Browser tab audio sharing depends on your device.</p>}
          </section>}
          <section className="rounded-2xl border border-white/10 bg-black/45 p-3 sm:p-4" aria-label="Live video meeting">
            {room.status === 'scheduled' && <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center"><Video className="h-9 w-9 text-violet-300" /><p className="font-semibold">The video room opens when the host starts the meeting.</p>{host && <button disabled={busy} onClick={() => act('start')} className="min-h-12 rounded-xl bg-violet-600 px-6 font-bold disabled:opacity-50">Start meeting</button>}</div>}
            {room.status === 'ended' && <div className="flex min-h-40 items-center justify-center text-center text-slate-300">This meeting has ended.</div>}
            {room.status === 'live' && !session && <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center"><p className="text-sm text-slate-300">Camera and microphone controls appear when you join. You can turn them off in the meeting.</p><button disabled={busy} onClick={join} className="min-h-12 rounded-xl bg-violet-600 px-6 font-bold disabled:opacity-50">{busy ? 'Connecting…' : 'Join video room'}</button></div>}
            {room.status === 'live' && session && <div className="meeting-livekit min-h-[400px]"><LiveKitRoom token={session.token} serverUrl={session.serverUrl} connect={true} video={false} audio={false} onError={e => setError(e?.message || 'Video connection failed.')} onDisconnected={() => setSession(null)}><p className="mb-2 text-xs text-slate-300">Connection: <ConnectionState /></p><VideoConference /></LiveKitRoom></div>}
          </section>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /><h2 className="font-bold">Private session</h2></div><p className="mt-2 text-xs leading-relaxed text-slate-300">Only signed-in guests with the invitation link can join. Share it with your artist, team, and decision makers.</p>{host && room.status !== 'ended' && <button disabled={busy} onClick={() => act('rotate')} className="mt-4 min-h-11 w-full rounded-xl border border-violet-400/40 px-3 text-sm font-semibold">Create new invite link</button>}{invite && <div className="mt-3"><p className="break-all text-xs text-violet-200">{invite}</p><button onClick={async () => { try { await navigator.clipboard.writeText(invite); setNotice('Invite link copied.'); } catch { setError('Copy failed. Select and copy the link above.'); } }} className="mt-2 flex min-h-11 items-center gap-2 text-sm"><Copy className="h-4 w-4" />Copy invite</button></div>}</div>
          {host && <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><h2 className="font-bold">Decision notes</h2><p className="mt-1 text-xs text-slate-400">Visible only to the host. Record feedback and signing next steps.</p><textarea aria-label="Private decision notes" rows={6} maxLength={4000} value={notes} onChange={e => { setNotes(e.target.value); setNotesDirty(true); }} className="mt-3 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-sm" placeholder="Strengths, questions, next meeting…" /><button disabled={busy} onClick={() => act('notes', { notes })} className="mt-2 min-h-11 w-full rounded-xl bg-white/10 text-sm font-semibold disabled:opacity-50">Save notes</button></div>}
          {host && room.status === 'live' && <button disabled={busy} onClick={() => act('end')} className="min-h-11 w-full rounded-xl border border-rose-400/40 p-3 text-sm font-bold text-rose-200">End meeting for everyone</button>}
        </aside>
      </div>}
    </div>
  </main>;
}