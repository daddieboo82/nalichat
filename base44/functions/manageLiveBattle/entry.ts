import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { withBattleLock } from '../../shared/liveBattleLock.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    if (user.is_banned || (user.timeout_until && Date.parse(user.timeout_until) > Date.now())) {
      return Response.json({ error: 'Battle actions are unavailable for this account.' }, { status: 403 });
    }
    const { battleId, action, opponentId } = await req.json();
    if (typeof battleId !== 'string' || !/^[a-z0-9_-]{10,80}$/i.test(battleId)) return Response.json({ error: 'Invalid battle.' }, { status: 400 });
    const entities = client.asServiceRole.entities;
    return await withBattleLock(entities, battleId, async () => {
      const battle = await entities.LiveBattle.get(battleId).catch(() => null);
      if (!battle) return Response.json({ error: 'Battle not found.' }, { status: 404 });
      if (action === 'invite') {
        if (battle.status !== 'draft' || user.id !== battle.creator_id || typeof opponentId !== 'string'
          || opponentId === user.id || !/^[a-z0-9_-]{10,80}$/i.test(opponentId)) {
          return Response.json({ error: 'Cannot send this invitation.' }, { status: 403 });
        }
        const rate = await consumeHourlyLimit(entities, user.id, 'battle_invite', 12);
        if (!rate.allowed) return Response.json({ error: 'Invitation limit reached. Try again later.' }, { status: 429 });
        const opponent = await entities.User.get(opponentId).catch(() => null);
        if (!opponent?.id || opponent.is_banned || !opponent.onboarding_completed) return Response.json({ error: 'Artist unavailable.' }, { status: 404 });
        const [blockedByTarget, blockedByCreator] = await Promise.all([
          entities.UserBlock.filter({ blocker_id: opponentId, blocked_user_id: user.id }, '-created_date', 1),
          entities.UserBlock.filter({ blocker_id: user.id, blocked_user_id: opponentId }, '-created_date', 1),
        ]);
        if (blockedByTarget.length || blockedByCreator.length) return Response.json({ error: 'Artist unavailable.' }, { status: 403 });
        await entities.LiveBattle.update(battleId, { opponent_id: opponentId, status: 'invited' });
        await entities.Notification.create({ recipient_id: opponentId, type: 'session_invite', actor_id: user.id, actor_name: user.display_name || 'Artist', message: 'You were invited to a live battle: ' + battle.title, link: '/battles/lobby', read: false }).catch(error => console.error('Battle invite notification failed', error));
      } else if (action === 'accept') {
        if (battle.status !== 'invited' || user.id !== battle.opponent_id) return Response.json({ error: 'Only the invited artist can accept.' }, { status: 403 });
        await entities.LiveBattle.update(battleId, { status: 'ready' });
        await entities.Notification.create({ recipient_id: battle.creator_id, type: 'session_invite', actor_id: user.id, actor_name: user.display_name || 'Artist', message: 'Your live battle invitation was accepted: ' + battle.title, link: '/battles/lobby', read: false }).catch(error => console.error('Battle accept notification failed', error));
      } else if (action === 'decline') {
        if (battle.status !== 'invited' || user.id !== battle.opponent_id) return Response.json({ error: 'Only the invited artist can decline.' }, { status: 403 });
        await entities.LiveBattle.update(battleId, { status: 'cancelled' });
      } else if (action === 'start') {
        if (battle.status !== 'ready' || user.id !== battle.creator_id || !battle.opponent_id) return Response.json({ error: 'Battle is not ready.' }, { status: 409 });
        if (!Deno.env.get('LIVEKIT_URL') || !Deno.env.get('LIVEKIT_API_KEY') || !Deno.env.get('LIVEKIT_API_SECRET')) {
          return Response.json({ error: 'Live streaming is not configured.' }, { status: 503 });
        }
        const { RoomServiceClient } = await import('npm:livekit-server-sdk@2.19.1');
        const liveHost = String(Deno.env.get('LIVEKIT_URL')).replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
        const liveService = new RoomServiceClient(liveHost, Deno.env.get('LIVEKIT_API_KEY')!, Deno.env.get('LIVEKIT_API_SECRET')!);
        try { await liveService.listRooms([]); }
        catch { return Response.json({ error: 'Live video connection could not be verified. Check the LiveKit project URL and key pair.' }, { status: 503 }); }
        const roomId = 'nali-battle-' + battleId + '-' + crypto.randomUUID();
        await entities.LiveBattle.update(battleId, { status: 'live', video_room_id: roomId });
      } else if (action === 'openVoting') {
        if (battle.status !== 'live' || user.id !== battle.creator_id || !battle.video_room_id) {
          return Response.json({ error: 'Battle is not live.' }, { status: 409 });
        }
        // A live room alone is not proof of a performance. Both performers must
        // actually have connected before any audience vote or award can be issued.
        const { RoomServiceClient } = await import('npm:livekit-server-sdk@2.19.1');
        const host = String(Deno.env.get('LIVEKIT_URL') || '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
        const service = new RoomServiceClient(host, Deno.env.get('LIVEKIT_API_KEY')!, Deno.env.get('LIVEKIT_API_SECRET')!);
        const participants = await service.listParticipants(battle.video_room_id);
        const present = new Set(participants.filter(p => Array.isArray(p.tracks) && p.tracks.length > 0).map(p => p.identity));
        if (!present.has(battle.creator_id) || !present.has(battle.opponent_id)) {
          return Response.json({ error: 'Both performers must join and publish media before voting opens.' }, { status: 409 });
        }
        await entities.LiveBattle.update(battleId, { status: 'voting', voting_end_at: new Date(Date.now() + 90000).toISOString() });
      } else if (action === 'cancel') {
        if (!['draft', 'invited', 'ready'].includes(battle.status) || user.id !== battle.creator_id) return Response.json({ error: 'Cannot cancel this battle.' }, { status: 409 });
        await entities.LiveBattle.update(battleId, { status: 'cancelled' });
      } else return Response.json({ error: 'Invalid action.' }, { status: 400 });
      return Response.json({ success: true, action, battleId });
    });
  } catch (error) {
    console.error('manageLiveBattle failed', error);
    return Response.json({ error: 'Battle action failed.' }, { status: 500 });
  }
});