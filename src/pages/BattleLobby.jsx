import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function BattleLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draft');
  const draftCard = useRef(null);
  const focusedDraftId = useRef(null);
  const [mine, setMine] = useState([]);
  const [invites, setInvites] = useState([]);
  const [publicBattles, setPublicBattles] = useState([]);
  const [awards, setAwards] = useState({ rap: [], singing: [] });
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState({});
  const [opponentFile, setOpponentFile] = useState({});
  const [rights, setRights] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [own, invited, live] = await Promise.all([
        base44.entities.LiveBattle.filter({ creator_id: user.id }, '-created_date', 50),
        base44.entities.LiveBattle.filter({ opponent_id: user.id }, '-created_date', 50),
        base44.functions.invoke('listLiveBattles', {}),
      ]);
      setMine(own); setInvites(invited); setPublicBattles(live?.data?.battles || []);
      setLoaded(true);
      base44.functions.invoke('listBattleAwards', {}).then(r => setAwards({ rap: r?.data?.rap || [], singing: r?.data?.singing || [] })).catch(() => {});
    } catch { setError('Could not load the battle lobby.'); }
  }, [user?.id]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 12000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    if (!user?.id) return;
    base44.functions.invoke('listPublicUsers', { includeAchievementCounts: false, includePresence: false })
      .then(r => setUsers((r?.data?.users || []).filter(u => u.id !== user.id)))
      .catch(() => {});
  }, [user?.id]);
  useEffect(() => {
    if (draftId && draftCard.current && focusedDraftId.current !== draftId) {
      focusedDraftId.current = draftId;
      draftCard.current.focus({ preventScroll: true });
      draftCard.current.scrollIntoView({ block: 'nearest' });
    }
  }, [draftId, mine]);

  async function act(battleId, action) {
    setBusy(battleId); setError('');
    try {
      const { data } = await base44.functions.invoke('manageLiveBattle', { battleId, action, ...(action === 'invite' ? { opponentId: selected[battleId] } : {}) });
      if (data?.success !== true || data.action !== action || data.battleId !== battleId) throw new Error('Battle action could not be confirmed.');
      if (action === 'start') {
        navigate('/battles/' + battleId);
        return;
      }
      await refresh();
    } catch (e) { setError(e?.response?.data?.error || e?.message || 'Battle action failed.'); }
    finally { setBusy(''); }
  }
  async function upload(battleId) {
    if (!rights[battleId] || !opponentFile[battleId]) return;
    setBusy(battleId); setError('');
    try {
      const form = new FormData();
      form.append('battle_id', battleId); form.append('file', opponentFile[battleId]); form.append('rights_confirmed', 'true');
      await base44.functions.invoke('uploadBattleOpponentTrack', form);
      await refresh();
    } catch (e) { setError(e?.response?.data?.error || 'Track upload failed.'); }
    finally { setBusy(''); }
  }
  const liveBattles = publicBattles.filter(battle => ['live', 'voting'].includes(battle.status));
  const myBattles = mine.filter(battle => battle.status !== 'cancelled');
  const invitations = invites.filter(battle => battle.status !== 'cancelled');
  const pendingInvitations = invitations.filter(battle => battle.status === 'invited');
  const emptyText = loaded ? 'No live battles right now.' : error ? 'Live battles are unavailable.' : 'Loading live battles…';

  return <main className="h-full overflow-y-auto bg-background px-4 pt-5 pb-28 text-foreground"><div className="mx-auto max-w-5xl">
    <header className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h1 className="font-heading text-3xl font-black tracking-tight">Battle Arena</h1>
        <p className="mt-1 text-sm text-muted-foreground">Watch live battles or challenge another artist.</p>
      </div>
      <Link to="/battles/new" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90">Create a battle</Link>
    </header>
    {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/15 p-3 text-destructive">{error}</p>}
    <nav aria-label="Battle Arena sections" className="mt-4 flex flex-wrap gap-2">
      <a href="#arena-live" className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary">Live now{liveBattles.length ? ` (${liveBattles.length})` : ''}</a>
      <a href="#arena-mine" className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary">My battles{myBattles.length ? ` (${myBattles.length})` : ''}</a>
      <a href="#arena-invites" className={`inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary ${pendingInvitations.length ? 'border-primary/60 bg-primary/15 text-foreground' : 'border-border bg-card'}`}>Invitations{pendingInvitations.length ? ` (${pendingInvitations.length} new)` : ''}</a>
    </nav>
    {pendingInvitations.length > 0 && <a href="#arena-invites" className="mt-3 flex min-h-12 items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-primary"><span>You have {pendingInvitations.length} battle invitation{pendingInvitations.length === 1 ? '' : 's'} to review</span><span aria-hidden="true">↓</span></a>}
    <section id="arena-live" className="mt-6 scroll-mt-5"><h2 className="text-xl font-bold">Live now</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{liveBattles.map(b =>
      <article key={b.id} className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-950/20 p-4"><p className="font-bold">{b.title}</p><p className="text-sm capitalize">{b.category} · {b.status}</p><Link className="mt-3 inline-flex items-center min-h-11 rounded-xl bg-primary px-4 py-2 text-primary-foreground font-bold" to={'/battles/' + b.id}>Watch battle</Link></article>)}
      {!liveBattles.length && <p className="text-sm text-muted-foreground">{emptyText}</p>}</div></section>
    <section id="arena-mine" className="mt-8 scroll-mt-5"><h2 className="text-xl font-bold">Your battles</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{myBattles.map(b =>
      <article key={b.id} ref={b.id === draftId ? draftCard : null} tabIndex={b.id === draftId ? -1 : undefined} className="min-w-0 rounded-xl border border-border bg-card/60 p-4 focus-visible:ring-2 focus-visible:ring-primary"><p className="break-words font-bold">{b.title}</p><p className="mb-3 text-sm capitalize text-muted-foreground">{b.category} · {b.status}</p>
        {b.status === 'draft' && <><label className="block text-sm">Invite an artist<select value={selected[b.id] || ''} onChange={e => setSelected(v => ({...v,[b.id]:e.target.value}))} className="mt-1 min-h-11 w-full min-w-0 rounded-xl bg-secondary px-3"><option value="">Choose an artist</option>{users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.id}</option>)}</select></label><button disabled={!selected[b.id] || busy === b.id} onClick={() => act(b.id,'invite')} className="mt-3 min-h-11 rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Send invitation</button></>}
        {b.status === 'invited' && <p className="text-sm text-amber-300">Waiting for the invited artist to accept.</p>}
        {b.status === 'ready' && <button disabled={busy === b.id} onClick={() => act(b.id,'start')} className="min-h-11 rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Start live room</button>}
        {['live','voting','completed'].includes(b.status) && <button onClick={() => navigate('/battles/' + b.id)} className="min-h-11 rounded-xl bg-primary px-4 py-2 text-primary-foreground">Enter battle</button>}
      </article>)}{loaded && !myBattles.length && <p className="text-sm text-muted-foreground">Your battles will appear here.</p>}</div></section>
    <section id="arena-invites" className="mt-8 scroll-mt-5"><h2 className="text-xl font-bold">Invitations</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{invitations.map(b =>
      <article key={b.id} className="rounded-xl border border-border bg-card/60 p-4"><p className="font-bold">{b.title}</p><p className="text-sm capitalize text-muted-foreground">{b.category} · {b.status}</p>
        {['invited','ready'].includes(b.status) && <div className="mt-3"><label className="text-sm">Your battle track (optional, 50 MB maximum)<input type="file" accept="audio/*" onChange={e => setOpponentFile(v => ({...v,[b.id]:e.target.files?.[0]}))} className="mt-2 block w-full" /></label><label className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={!!rights[b.id]} onChange={e => setRights(v => ({...v,[b.id]:e.target.checked}))} />I have permission to use this track.</label>{opponentFile[b.id] && <button disabled={!rights[b.id] || busy === b.id} onClick={() => upload(b.id)} className="mt-2 rounded-lg border px-4 py-2 disabled:opacity-50">Upload my track</button>}</div>}
        {b.status === 'invited' && <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy === b.id} onClick={() => act(b.id,'accept')} className="min-h-11 rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Accept battle</button><button disabled={busy === b.id} onClick={() => act(b.id,'decline')} className="min-h-11 rounded-xl border border-border px-4 py-2 disabled:opacity-50">Decline</button></div>}
        {['live','voting','completed'].includes(b.status) && <Link to={'/battles/' + b.id} className="mt-3 inline-flex items-center min-h-11 rounded-xl bg-primary px-4 py-2 text-primary-foreground">Enter battle</Link>}
      </article>)}{loaded && !invitations.length && <p className="text-sm text-muted-foreground">No invitations yet.</p>}</div></section>
    <details className="mt-6 rounded-2xl border border-border bg-card/60 px-4 pb-4"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Battle awards</summary><p className="mt-1 text-sm text-muted-foreground">Ranked by verified battle wins, then audience quality points. No award is shown until a battle is completed.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{[['Best Rapper', awards.rap], ['Best Singer', awards.singing]].map(([label, rows]) => <div key={label} className="rounded-xl border border-amber-400/20 bg-card/60 p-4"><h3 className="font-bold text-amber-300">{label}</h3>{rows.length ? <ol className="mt-2 space-y-2">{rows.slice(0,5).map((row, i) => <li key={row.id} className="text-sm">{i + 1}. {row.artist_name} · {row.wins} wins · {row.points} points</li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">No verified winner yet.</p>}</div>)}</div></details>
  </div></main>;
}