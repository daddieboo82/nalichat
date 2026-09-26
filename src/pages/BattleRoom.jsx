import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LiveKitRoom, VideoConference, GridLayout, ParticipantTile, RoomAudioRenderer, StartAudio, useTracks, ConnectionState } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

function AudienceStage() {
  const tracks = useTracks([Track.Source.Camera]);
  return <div className="space-y-3"><div className="aspect-video min-h-48 overflow-hidden rounded-2xl bg-black">
    <GridLayout tracks={tracks} className="h-full">{(track) => <ParticipantTile trackRef={track} />}</GridLayout>
  </div><RoomAudioRenderer /><StartAudio label="Enable live audio" /></div>;
}
export default function BattleRoom() {
  const { battleId } = useParams();
  const { user } = useAuth();
  const [battle, setBattle] = useState(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [myVote, setMyVote] = useState('');
  const [scores, setScores] = useState({ creator: { musicality: 3, originality: 3, technique: 3 }, opponent: { musicality: 3, originality: 3, technique: 3 } });
  const [reactions, setReactions] = useState({ count: 0, byKind: {} });
  const [audienceCount, setAudienceCount] = useState(null);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState('');
  const [reportReason, setReportReason] = useState('harassment');
  const [reported, setReported] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await base44.functions.invoke('listLiveBattles', { battleId });
      const row = response?.data?.battles?.[0];
      if (row) setBattle(row);
      else setError('Battle is not available.');
    } catch { setError('Could not load battle.'); }
  }, [battleId]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 10000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!battleId || !['live','voting'].includes(battle?.status)) return undefined;
    let active = true;
    const load = () => base44.functions.invoke('getBattleAudienceCount', { battleId })
      .then(r => { if (active && r?.data?.success) setAudienceCount(r.data.audienceCount); }).catch(() => { if (active) setAudienceCount(null); });
    load(); const timer = setInterval(load, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [battleId, battle?.status]);
  useEffect(() => {
    if (!battleId || battle?.status !== 'live') return undefined;
    let active = true;
    const load = () => base44.functions.invoke('getBattleReactions', { battleId })
      .then(r => { if (active && r?.data?.success) setReactions(r.data); }).catch(() => {});
    load();
    const timer = setInterval(load, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [battleId, battle?.status]);
  useEffect(() => {
    let active = true;
    base44.functions.invoke('joinBattleRoom', { battleId })
      .then(r => { if (active) setSession(r.data); })
      .catch(e => { if (active) setError(e?.response?.data?.error || 'Could not join live video.'); });
    return () => { active = false; };
  }, [battleId]);
  useEffect(() => {
    if (battle?.status !== 'voting' || !user?.id) return;
    base44.entities.LiveBattleVote.filter({ battle_id: battleId, voter_id: user.id }, '-created_date', 1)
      .then(rows => { if (rows.length) setMyVote('recorded'); }).catch(() => {});
  }, [battleId, battle?.status, user?.id]);
  const performer = user?.id === battle?.creator_id || user?.id === battle?.opponent_id;
  const host = user?.id === battle?.creator_id;
  const voting = battle?.status === 'voting' && Date.parse(battle?.voting_end_at || '') > now;
  const seconds = Math.max(0, Math.ceil((Date.parse(battle?.voting_end_at || '') - now) / 1000) || 0);
  async function action(name) {
    setBusy(true); setError('');
    try {
      const endpoint = name === 'score' ? 'castBattleVote' : name === 'finish' ? 'finalizeBattle' : 'manageLiveBattle';
      await base44.functions.invoke(endpoint, { battleId, ...(name === 'score' ? scores : { action: 'openVoting' }) });
      if (name === 'score') setMyVote('recorded');
      await refresh();
    } catch (e) { setError(e?.response?.data?.error || 'Action failed. Please retry.'); }
    finally { setBusy(false); }
  }
  async function react(reaction) {
    if (reactionBusy) return;
    setReactionBusy(true); setError('');
    try {
      await base44.functions.invoke('reactBattle', { battleId, reaction });
      const result = await base44.functions.invoke('getBattleReactions', { battleId });
      if (result?.data?.success) setReactions(result.data);
    } catch (e) { setError(e?.response?.data?.error || 'Could not send reaction.'); }
    finally { setTimeout(() => setReactionBusy(false), 3000); }
  }
  async function submitReport() {
    if (!reportTarget || busy) return;
    setBusy(true); setError('');
    try { await base44.functions.invoke('reportBattle', { battleId, targetId: reportTarget, reason: reportReason }); setReported(true); }
    catch (e) { setError(e?.response?.data?.error || 'Could not submit report.'); }
    finally { setBusy(false); }
  }
  return <div className="h-full overflow-y-auto bg-slate-950 px-4 py-6 pb-28 text-white">
    <div className="mx-auto max-w-6xl">
      <Link to="/battles" className="text-sm text-fuchsia-300 hover:underline">← Battles</Link>
      <h1 className="mt-4 text-3xl font-black">{battle?.title || 'Live battle'}</h1>
      <p className="mt-1 text-sm capitalize text-slate-300">{battle?.category} · {battle?.status || 'Loading'} {audienceCount !== null && '· ' + audienceCount + ' watching'} {voting && '· Voting ends in ' + seconds + 's'}</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-950 p-4 text-rose-200">{error}</p>}
      {session?.ready && <div className="mt-5 rounded-2xl border border-fuchsia-400/30 bg-black/50 p-3">
        <LiveKitRoom serverUrl={session.serverUrl} token={session.token} connect={true}
          video={session.role === 'performer'} audio={session.role === 'performer'}
          onError={e => setError(e?.message || 'Live video connection failed.')}
          onDisconnected={() => setError('Disconnected from the live room. Reload to reconnect.')}>
          <div className="mb-2 text-sm text-slate-300">Connection: <ConnectionState /></div>
          {session.role === 'performer' ? <VideoConference /> : <AudienceStage />}
        </LiveKitRoom>
      </div>}
      {battle?.status === 'live' && <section className="mt-5 rounded-xl border border-fuchsia-400/25 bg-fuchsia-950/20 p-4" aria-label="Audience reactions"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Crowd energy</h2><p className="text-xs text-slate-300">{reactions.count} real reactions in the last minute</p></div>{!performer && <div className="flex gap-2">{[['fire','🔥'],['cheer','🙌'],['love','💜']].map(([kind, emoji]) => <button key={kind} type="button" aria-label={'React ' + kind} disabled={reactionBusy} onClick={() => react(kind)} className="min-h-11 min-w-11 rounded-xl border border-white/20 bg-black/30 text-xl disabled:opacity-50">{emoji}</button>)}</div>}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 transition-all" style={{ width: Math.min(100, reactions.count * 5) + '%' }} /></div></section>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[['creator', battle?.creator_id, battle?.creator_name || 'Artist one', battle?.creator_track_url, battle?.creator_track_name],
          ['opponent', battle?.opponent_id, 'Artist two', battle?.opponent_track_url, battle?.opponent_track_name]].map(([side, id, name, url, track]) =>
          <article key={side} className="rounded-2xl border border-white/15 bg-white/5 p-4"><p className="font-bold">{name}</p>{url && <><p className="my-2 truncate text-xs text-slate-400">{track}</p><audio controls src={url} className="w-full" /></>}
            {battle?.status === 'completed' && <div className="mt-3 text-sm">{battle?.winner_id === id && <strong className="text-amber-300">🏆 {battle.award_title} · </strong>}<strong>{side === 'creator' ? battle.creator_score : battle.opponent_score} quality points</strong><p className="mt-1 text-xs text-slate-400">Musicality {battle?.[side + '_musicality_score'] || 0} · Originality {battle?.[side + '_originality_score'] || 0} · {battle.category === 'rap' ? 'Flow' : 'Vocals'} {battle?.[side + '_technique_score'] || 0}</p></div>}
          </article>)}
      </div>
      {voting && !performer && !myVote && <section className="mt-5 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-950/20 p-4"><h2 className="text-xl font-bold">Score both performers</h2><p className="mt-1 text-sm text-slate-300">Rate each artist 1–5 on musicality, originality, and {battle.category === 'rap' ? 'flow' : 'vocals'}. One scorecard per audience member.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{[['creator',battle.creator_name || 'Artist one'],['opponent','Artist two']].map(([side,name]) => <div key={side} className="rounded-xl bg-black/30 p-3"><h3 className="font-bold">{name}</h3>{['musicality','originality','technique'].map(criterion => <label key={criterion} className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="capitalize">{criterion === 'technique' ? battle.category === 'rap' ? 'Flow' : 'Vocals' : criterion}</span><select aria-label={name + ' ' + criterion} value={scores[side][criterion]} onChange={e => setScores(prev => ({...prev,[side]:{...prev[side],[criterion]:Number(e.target.value)}}))} className="min-h-11 rounded-lg bg-slate-800 px-3">{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>)}</div>)}</div><button disabled={busy} onClick={() => action('score')} className="mt-4 min-h-11 rounded-xl bg-fuchsia-600 px-5 font-bold disabled:opacity-50">Submit one scorecard</button></section>}
      {myVote && <p role="status" className="mt-4 text-emerald-300">Your scorecard was recorded.</p>
      {battle?.status === 'completed' && !battle?.winner_id && <p className="mt-4 font-bold">Tie battle · no winner awarded</p>}
      {host && battle?.status === 'live' && <button disabled={busy} onClick={() => action('openVoting')} className="mt-5 min-h-11 rounded-xl border border-fuchsia-400 px-5 font-bold disabled:opacity-50">End performance · open 90-second scoring</button>}
      {performer && battle?.status === 'voting' && !voting && <button disabled={busy} onClick={() => action('finish')} className="mt-5 min-h-11 rounded-xl bg-amber-500 px-5 font-bold text-black disabled:opacity-50">Finalize result</button>}
      <section className="mt-7 rounded-xl border border-white/15 p-4"><h2 className="font-bold">Report a live performer</h2><div className="mt-3 flex flex-wrap gap-2"><select aria-label="Performer to report" value={reportTarget} onChange={e => setReportTarget(e.target.value)} className="min-h-11 rounded-lg bg-slate-800 p-2"><option value="">Choose performer</option>{battle?.creator_id !== user?.id && <option value={battle?.creator_id}>{battle?.creator_name || 'Artist one'}</option>}{battle?.opponent_id !== user?.id && <option value={battle?.opponent_id}>Artist two</option>}</select><select aria-label="Report reason" value={reportReason} onChange={e => setReportReason(e.target.value)} className="min-h-11 rounded-lg bg-slate-800 p-2"><option value="harassment">Harassment</option><option value="hate_speech">Hate speech</option><option value="sexual_content">Sexual content</option><option value="violence">Violence</option><option value="spam">Spam</option><option value="other">Other</option></select><button disabled={!reportTarget || busy || reported} onClick={submitReport} className="min-h-11 rounded-lg border border-white/30 px-4 disabled:opacity-50">{reported ? 'Report submitted' : 'Submit report'}</button></div><p className="mt-2 text-xs text-slate-400">Reports go to the moderation queue for review.</p></section>
      <p className="mt-6 text-xs text-slate-400">One scorecard per audience account. Performers cannot score their own battle. Leave the room with the in-room control.</p>
    </div>
  </div>;
}