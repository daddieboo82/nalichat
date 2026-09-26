import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function BattleLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState([]);
  const [invites, setInvites] = useState([]);
  const [publicBattles, setPublicBattles] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState({});
  const [opponentFile, setOpponentFile] = useState({});
  const [rights, setRights] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [own, invited, live] = await Promise.all([
        base44.entities.LiveBattle.filter({ creator_id: user.id }, '-created_date', 50),
        base44.entities.LiveBattle.filter({ opponent_id: user.id }, '-created_date', 50),
        base44.functions.invoke('listLiveBattles', {}),
      ]);
      setMine(own); setInvites(invited); setPublicBattles(live?.data?.battles || []);
    } catch { setError('Could not load the battle lobby.'); }
  }, [user?.id]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 12000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    if (!user?.id) return;
    base44.functions.invoke('listPublicUsers', { includeAchievementCounts: false, includePresence: false })
      .then(r => setUsers((r?.data?.users || []).filter(u => u.id !== user.id)))
      .catch(() => {});
  }, [user?.id]);
  async function act(battleId, action) {
    setBusy(battleId); setError('');
    try {
      await base44.functions.invoke('manageLiveBattle', { battleId, action, ...(action === 'invite' ? { opponentId: selected[battleId] } : {}) });
      await refresh();
    } catch (e) { setError(e?.response?.data?.error || 'Battle action failed.'); }
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
  return <div className="h-full overflow-y-auto bg-slate-950 px-4 py-8 pb-28 text-white"><div className="mx-auto max-w-5xl">
    <Link to="/battles" className="text-sm text-fuchsia-300">← Battle stage</Link><h1 className="mt-3 text-3xl font-black">Battle lobby</h1>
    <p className="mt-2 text-slate-300">Invite an artist, accept a challenge, or watch a live matchup.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-950 p-3">{error}</p>}
    <section className="mt-8"><h2 className="text-xl font-bold">Live now</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{publicBattles.filter(b => ['live','voting'].includes(b.status)).map(b =>
      <article key={b.id} className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-950/20 p-4"><p className="font-bold">{b.title}</p><p className="text-sm capitalize">{b.category} · {b.status}</p><Link className="mt-3 inline-block rounded-lg bg-fuchsia-600 px-4 py-2 font-bold" to={'/battles/' + b.id}>Watch battle</Link></article>)}
      {!publicBattles.some(b => ['live','voting'].includes(b.status)) && <p className="text-sm text-slate-400">No live battles right now.</p>}</div></section>
    <section className="mt-8"><h2 className="text-xl font-bold">Your battles</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{mine.filter(b => b.status !== 'cancelled').map(b =>
      <article key={b.id} className="rounded-xl border border-white/15 bg-white/5 p-4"><p className="font-bold">{b.title}</p><p className="mb-3 text-sm capitalize text-slate-300">{b.category} · {b.status}</p>
        {b.status === 'draft' && <><label className="block text-sm">Invite an artist<select value={selected[b.id] || ''} onChange={e => setSelected(v => ({...v,[b.id]:e.target.value}))} className="mt-1 w-full rounded-lg bg-slate-800 p-3"><option value="">Choose an artist</option>{users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.id}</option>)}</select></label><button disabled={!selected[b.id] || busy === b.id} onClick={() => act(b.id,'invite')} className="mt-3 rounded-lg bg-fuchsia-600 px-4 py-2 disabled:opacity-50">Send invitation</button></>}
        {b.status === 'invited' && <p className="text-sm text-amber-300">Waiting for the invited artist to accept.</p>}
        {b.status === 'ready' && <button disabled={busy === b.id} onClick={() => act(b.id,'start')} className="rounded-lg bg-fuchsia-600 px-4 py-2 disabled:opacity-50">Start live room</button>}
        {['live','voting','completed'].includes(b.status) && <button onClick={() => navigate('/battles/' + b.id)} className="rounded-lg bg-fuchsia-600 px-4 py-2">Enter battle</button>}
      </article>)}{mine.length === 0 && <p className="text-sm text-slate-400">Create a battle draft on the stage first.</p>}</div></section>
    <section className="mt-8"><h2 className="text-xl font-bold">Invitations</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{invites.filter(b => b.status !== 'cancelled').map(b =>
      <article key={b.id} className="rounded-xl border border-white/15 bg-white/5 p-4"><p className="font-bold">{b.title}</p><p className="text-sm capitalize text-slate-300">{b.category} · {b.status}</p>
        {['invited','ready'].includes(b.status) && <div className="mt-3"><label className="text-sm">Your battle track (optional, 50 MB maximum)<input type="file" accept="audio/*" onChange={e => setOpponentFile(v => ({...v,[b.id]:e.target.files?.[0]}))} className="mt-2 block w-full" /></label><label className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={!!rights[b.id]} onChange={e => setRights(v => ({...v,[b.id]:e.target.checked}))} />I have permission to use this track.</label>{opponentFile[b.id] && <button disabled={!rights[b.id] || busy === b.id} onClick={() => upload(b.id)} className="mt-2 rounded-lg border px-4 py-2 disabled:opacity-50">Upload my track</button>}</div>}
        {b.status === 'invited' && <button disabled={busy === b.id} onClick={() => act(b.id,'accept')} className="mt-3 rounded-lg bg-fuchsia-600 px-4 py-2 disabled:opacity-50">Accept battle</button>}
        {['live','voting','completed'].includes(b.status) && <Link to={'/battles/' + b.id} className="mt-3 inline-block rounded-lg bg-fuchsia-600 px-4 py-2">Enter battle</Link>}
      </article>)}{invites.length === 0 && <p className="text-sm text-slate-400">No invitations yet.</p>}</div></section>
  </div></div>;
}