import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, Music2, Video } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { copyToClipboard } from '@/lib/clipboard';

const emptyForm = { kind: 'business', title: '', artistName: '', agenda: '', startsAt: '', trackUrl: '' };
const fieldClass = 'mt-1.5 min-h-12 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-foreground';
const panelClass = 'min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6';
const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary';
const formatDate = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
const message = e => e?.response?.data?.error || 'Could not complete this request. Please try again.';

function getInvitePath(value) {
  try {
    const origin = window.location.origin;
    const url = new URL(value.trim(), origin);
    if (![origin, 'https://nalichat.org', 'https://nalichat.base44.app'].includes(url.origin)) return null;
    const roomPath = /^\/meetings\/[a-z0-9_-]{10,80}\/?$/i.exec(url.pathname);
    const invite = url.searchParams.get('invite');
    if (!roomPath || url.username || url.password || !invite || !/^[a-z0-9_-]{30,80}$/i.test(invite)) return null;
    return url.pathname.replace(/\/$/, '') + '?invite=' + encodeURIComponent(invite);
  } catch {
    return null;
  }
}

export default function MeetingHub() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState(null);
  const [roomsFailed, setRoomsFailed] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [joinLink, setJoinLink] = useState('');
  const [joinError, setJoinError] = useState('');

  const refresh = useCallback(async () => {
    setRoomsFailed(false);
    try {
      const { data } = await base44.functions.invoke('meetingHub', { action: 'list' });
      setRooms(data.rooms || []);
    } catch {
      setRoomsFailed(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));

  async function create(event) {
    event.preventDefault();
    if (busy) return;
    if (form.title.trim().length < 3) {
      setError('Enter a meeting name with at least 3 characters.');
      return;
    }
    setBusy(true);
    setError('');
    setCopyMessage('');
    try {
      const { data: { room, inviteCode } } = await base44.functions.invoke('meetingHub', {
        action: 'create',
        ...form,
        trackUrl: form.kind === 'listening' ? form.trackUrl : '',
        startsAt: (form.startsAt ? new Date(form.startsAt) : new Date()).toISOString(),
      });
      const path = '/meetings/' + room.id;
      setCreated({ path, invite: window.location.origin + path + '?invite=' + encodeURIComponent(inviteCode) });
      setForm(emptyForm);
      void refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  function join(event) {
    event.preventDefault();
    const path = getInvitePath(joinLink);
    if (path) navigate(path);
    else setJoinError('Paste the full NaliChat invitation link.');
  }

  return (
    <main className="nali-workspace min-h-full overflow-y-auto bg-background px-4 pt-6 pb-[max(7rem,env(safe-area-inset-bottom))] text-foreground">
      <div className="mx-auto max-w-4xl space-y-5">
        <header>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">Meeting Hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a private room or join with an invite.</p>
        </header>

        <div className="grid items-start gap-4 md:grid-cols-2">
          <section className={panelClass} aria-labelledby="create-meeting-title">
            <h2 id="create-meeting-title" className="text-lg font-bold">Create a meeting</h2>
            <form onSubmit={create} className="space-y-3">
              <label className="block text-sm font-medium">
                Meeting name
                <input required minLength={3} maxLength={100} value={form.title} onChange={e => update('title', e.target.value)} placeholder="Team check-in" className={fieldClass} />
              </label>
              <details className="rounded-xl border border-border px-3">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Schedule or add details</summary>
                <div className="space-y-3 pb-3">
                  <label className="block text-sm font-medium">Meeting type
                    <select value={form.kind} onChange={e => update('kind', e.target.value)} className={fieldClass}>
                      <option value="business">Video meeting</option>
                      <option value="listening">Listening party</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium">Start time
                    <input type="datetime-local" value={form.startsAt} onChange={e => update('startsAt', e.target.value)} className={fieldClass} />
                    <span className="mt-1 block text-xs text-muted-foreground">Leave blank for now.</span>
                  </label>
                  {form.kind === 'listening' && (
                    <>
                      <label className="block text-sm font-medium">Artist name
                        <input maxLength={80} value={form.artistName} onChange={e => update('artistName', e.target.value)} className={fieldClass} />
                      </label>
                      <label className="block text-sm font-medium">Audio link
                        <input type="url" value={form.trackUrl} onChange={e => update('trackUrl', e.target.value)} placeholder="https://…" className={fieldClass} />
                        <span className="mt-1 block text-xs text-muted-foreground">Use a public HTTPS link to music you can share. Guests control their own playback.</span>
                      </label>
                    </>
                  )}
                  <label className="block text-sm font-medium">Agenda
                    <textarea maxLength={1200} rows={3} value={form.agenda} onChange={e => update('agenda', e.target.value)} className={fieldClass + ' py-2'} />
                  </label>
                </div>
              </details>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {busy ? 'Creating…' : 'Create meeting'}
              </button>
            </form>
            {created && (
              <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                <p role="status" className="text-sm font-semibold">Meeting created</p>
                <label className="block text-sm font-medium">Private invite link
                  <input readOnly value={created.invite} onFocus={e => e.target.select()} className={fieldClass} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Link to={created.path} className={actionClass}>Open room <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                  <button type="button" className={actionClass} onClick={async () => setCopyMessage(await copyToClipboard(created.invite) ? 'Invite copied.' : 'Select the invite link to copy it.')}>
                    <Copy className="h-4 w-4" aria-hidden="true" /> Copy invite
                  </button>
                </div>
                {copyMessage && <p role="status" className="text-xs text-muted-foreground">{copyMessage}</p>}
              </div>
            )}
          </section>

          <section className={panelClass} aria-labelledby="join-meeting-title">
            <h2 id="join-meeting-title" className="text-lg font-bold">Join a meeting</h2>
            <form onSubmit={join} className="space-y-3">
              <label className="block text-sm font-medium">Invite link
                <input required value={joinLink} onChange={e => { setJoinLink(e.target.value); setJoinError(''); }} inputMode="url" maxLength={2048} placeholder="Paste your invite link" className={fieldClass} />
              </label>
              {joinError && <p role="alert" className="text-sm text-destructive">{joinError}</p>}
              <button type="submit" className={actionClass}>Join meeting</button>
            </form>
          </section>
        </div>

        <section className={panelClass} aria-labelledby="your-meetings-title">
          <h2 id="your-meetings-title" className="text-lg font-bold">Your meetings</h2>
          {roomsFailed && <p className="text-sm text-muted-foreground">Couldn’t load meetings. <button type="button" onClick={refresh} className="font-semibold underline">Retry</button></p>}
          {!roomsFailed && !rooms && <p role="status" className="text-sm text-muted-foreground">Loading meetings…</p>}
          {!roomsFailed && rooms?.length === 0 && <p className="text-sm text-muted-foreground">No meetings yet.</p>}
          {rooms?.length > 0 && (
            <ul className="space-y-2">
              {rooms.map(room => {
                const Icon = room.kind === 'listening' ? Music2 : Video;
                return (
                  <li key={room.id}>
                    <Link to={'/meetings/' + room.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 hover:border-primary/60">
                      <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{room.title}</strong>
                        <span className="text-xs text-muted-foreground">{formatDate(room.starts_at)} · {room.status}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <Link to="/" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">← Home</Link>
      </div>
    </main>
  );
}
