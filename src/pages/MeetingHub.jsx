import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CalendarDays, Video, Music2, ArrowRight, Copy } from 'lucide-react';

const starterDate = () => {
  const d = new Date(Date.now() + 15 * 60000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const formatDate = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
const message = e => e?.response?.data?.error || 'Could not complete this request. Please try again.';

export default function MeetingHub() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({ kind: 'listening', title: '', artistName: '', agenda: '', startsAt: starterDate(), trackUrl: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState('');
  const refresh = useCallback(async () => {
    try { const result = await base44.functions.invoke('meetingHub', { action: 'list' }); setRooms(result.data.rooms || []); }
    catch (e) { setError(message(e)); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));
  async function create(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await base44.functions.invoke('meetingHub', {
        action: 'create', ...form, startsAt: new Date(form.startsAt).toISOString()
      });
      const { room, inviteCode } = response.data;
      const url = window.location.origin + '/meetings/' + room.id + '?invite=' + encodeURIComponent(inviteCode);
      setInvite(url);
      await refresh();
      setForm({ kind: 'listening', title: '', artistName: '', agenda: '', startsAt: starterDate(), trackUrl: '' });
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  return <main className="min-h-full overflow-y-auto bg-slate-950 px-4 py-6 pb-28 text-white">
    <div className="mx-auto max-w-5xl">
      <header className="rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-950 via-slate-950 to-cyan-950 p-5 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-violet-300">NaliBase · private rooms</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Meeting Hub</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">Meet your team on video, or host a private listening party to discuss an artist's music before a signing decision.</p>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/50 p-3 text-rose-200">{error}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6" aria-label="Create a meeting">
          <h2 className="text-xl font-bold">Plan a private room</h2>
          <p className="mt-1 text-sm text-slate-400">Only signed-in people with your invite link can enter. You control when video opens.</p>
          <form onSubmit={create} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Meeting type">
              {[['listening','Listening party',Music2],['business','Business meeting',Video]].map(([value,label,Icon]) => <button key={value} type="button" aria-pressed={form.kind === value} onClick={() => update('kind', value)} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-bold ${form.kind === value ? 'border-violet-400 bg-violet-500/20' : 'border-white/15 bg-black/25'}`}><Icon className="h-4 w-4" />{label}</button>)}
            </div>
            <label className="block text-sm font-semibold">Meeting title<input required minLength={3} maxLength={100} value={form.title} onChange={e => update('title', e.target.value)} placeholder="Artist showcase and label discussion" className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-slate-900 px-3 text-white" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Artist name (optional)<input maxLength={80} value={form.artistName} onChange={e => update('artistName', e.target.value)} placeholder="Who we're listening to" className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-slate-900 px-3 text-white" /></label>
              <label className="block text-sm font-semibold">Start time<input required type="datetime-local" value={form.startsAt} onChange={e => update('startsAt', e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-slate-900 px-3 text-white" /></label>
            </div>
            <label className="block text-sm font-semibold">Agenda<textarea maxLength={1200} rows={3} value={form.agenda} onChange={e => update('agenda', e.target.value)} placeholder="Introductions, tracks, feedback, next steps..." className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white" /></label>
            {form.kind === 'listening' && <label className="block text-sm font-semibold">HTTPS audio track link (optional)<input type="url" value={form.trackUrl} onChange={e => update('trackUrl', e.target.value)} placeholder="https://..." className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-slate-900 px-3 text-white" /><span className="mt-1 block text-xs font-normal text-slate-400">Anyone invited can play this link. Share only music you have permission to present. Each listener controls their own playback.</span></label>}
            <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-violet-600 px-5 font-bold hover:bg-violet-500 disabled:opacity-50">{busy ? 'Creating room…' : 'Create private room'}</button>
          </form>
          {invite && <div role="status" className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-950/35 p-3"><p className="text-sm font-bold text-emerald-200">Room created. Share this invitation privately:</p><p className="mt-2 break-all text-xs text-slate-200">{invite}</p><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(invite); } catch { setError('Copy failed. Select and copy the invitation above.'); } }} className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm"><Copy className="h-4 w-4" />Copy invite link</button></div>}
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6" aria-label="Your rooms">
          <h2 className="text-xl font-bold">Your rooms</h2><p className="mt-1 text-sm text-slate-400">Open a room to start video, share a new invite, and keep private decision notes.</p>
          <div className="mt-5 space-y-3">{rooms.length ? rooms.map(room => <button type="button" key={room.id} onClick={() => navigate('/meetings/' + room.id)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-4 text-left hover:border-violet-400/50"><span className="rounded-xl bg-violet-500/15 p-2">{room.kind === 'listening' ? <Music2 className="h-5 w-5 text-violet-300" /> : <Video className="h-5 w-5 text-cyan-300" />}</span><span className="min-w-0 flex-1"><strong className="block truncate">{room.title}</strong><small className="text-slate-400">{formatDate(room.starts_at)} · {room.status}</small></span><ArrowRight className="h-4 w-4" /></button>) : <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-slate-400">No rooms yet. Create your first meeting above.</p>}</div>
        </section>
      </div>
      <Link to="/" className="mt-6 inline-flex min-h-11 items-center text-sm text-violet-300 hover:underline">← Home</Link>
    </div>
  </main>;
}