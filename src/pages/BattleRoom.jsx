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
    let active = true;
    base44.functions.invoke('joinBattleRoom', { battleId })
      .then(r => { if (active) setSession(r.data); })
      .catch(e => { if (active) setError(e?.response?.data?.error || 'Could not join live video.'); });
    return () => { active = false; };
  }, [battleId]);
  const performer = user?.id === battle?.creator_id || user?.id === battle?.opponent_id;
  const host = user?.id === battle?.creator_id;
  const voting = battle?.status === 'voting' && Date.parse(battle?.voting_end_at || '') > now;
  const seconds = Math.max(0, Math.ceil((Date.parse(battle?.voting_end_at || '') - now) / 1000) || 0);
  async function action(name, performerId) {
    setBusy(true); setError('');
    try {
      const endpoint = name === 'vote' ? 'castBattleVote' : name === 'finish' ? 'finalizeBattle' : 'manageLiveBattle';
      await base44.functions.invoke(endpoint, { battleId, ...(name === 'vote' ? { performerId } : { action: 'openVoting' }) });
      if (name === 'vote') setMyVote(performerId);
      await refresh();
    } catch (e) { setError(e?.response?.data?.error || 'Action failed. Please retry.'); }
    finally { setBusy(false); }
  }
  return <div className="h-full overflow-y-auto bg-slate-950 px-4 py-6 pb-28 text-white">
    <div className="mx-auto max-w-6xl">
      <Link to="/battles" className="text-sm text-fuchsia-300 hover:underline">← Battles</Link>
      <h1 className="mt-4 text-3xl font-black">{battle?.title || 'Live battle'}</h1>
      <p className="mt-1 text-sm capitalize text-slate-300">{battle?.category} · {battle?.status || 'Loading'} {voting && '· Voting ends in ' + seconds + 's'}</p>
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
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[['creator', battle?.creator_id, battle?.creator_name || 'Artist one', battle?.creator_track_url, battle?.creator_track_name],
          ['opponent', battle?.opponent_id, 'Artist two', battle?.opponent_track_url, battle?.opponent_track_name]].map(([side, id, name, url, track]) =>
          <article key={side} className="rounded-2xl border border-white/15 bg-white/5 p-4"><p className="font-bold">{name}</p>{url && <><p className="my-2 truncate text-xs text-slate-400">{track}</p><audio controls src={url} className="w-full" /></>}
            {voting && !performer && !myVote && <button disabled={busy} onClick={() => action('vote', id)} className="mt-3 min-h-11 rounded-xl bg-fuchsia-600 px-4 font-bold disabled:opacity-50">Vote for {name}</button>}
            {battle?.status === 'completed' && <p className="mt-3 text-sm">{battle?.winner_id === id ? '🏆 ' + battle.award_title : ''} · {side === 'creator' ? battle.creator_votes : battle.opponent_votes} votes</p>}
          </article>)}
      </div>
      {myVote && <p role="status" className="mt-4 text-emerald-300">Your vote was recorded.</p>}
      {battle?.status === 'completed' && !battle?.winner_id && <p className="mt-4 font-bold">Tie battle · no winner awarded</p>}
      {host && battle?.status === 'live' && <button disabled={busy} onClick={() => action('openVoting')} className="mt-5 min-h-11 rounded-xl border border-fuchsia-400 px-5 font-bold disabled:opacity-50">End performance · open 90-second vote</button>}
      {performer && battle?.status === 'voting' && !voting && <button disabled={busy} onClick={() => action('finish')} className="mt-5 min-h-11 rounded-xl bg-amber-500 px-5 font-bold text-black disabled:opacity-50">Finalize result</button>}
      <p className="mt-6 text-xs text-slate-400">One vote per audience account. Performers cannot vote. Leave the room with the in-room control. Report abuse using NaliChat’s reporting tools.</p>
    </div>
  </div>;
}