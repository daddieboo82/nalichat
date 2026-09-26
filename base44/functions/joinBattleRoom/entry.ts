import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { AccessToken } from 'npm:livekit-server-sdk@2.19.1';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user?.id) return Response.json({ error: 'Sign in to join a battle.' }, { status: 401 });
    if (user.is_banned || (user.timeout_until && Date.parse(user.timeout_until) > Date.now())) {
      return Response.json({ error: 'You cannot join a battle right now.' }, { status: 403 });
    }
    const key = Deno.env.get('LIVEKIT_API_KEY');
    const secret = Deno.env.get('LIVEKIT_API_SECRET');
    const url = Deno.env.get('LIVEKIT_URL');
    if (!key || !secret || !url || !/^wss:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url)) {
      return Response.json({ ready: false, error: 'Live broadcast setup in progress.' }, { status: 503 });
    }
    const body = await req.json();
    const battleId = String(body?.battleId || '');
    if (!/^[a-z0-9_-]{10,80}$/i.test(battleId)) return Response.json({ error: 'Invalid battle.' }, { status: 400 });
    const battle = await client.asServiceRole.entities.LiveBattle.get(battleId).catch(() => null);
    if (!battle || battle.status !== 'live' || !battle.opponent_id || !battle.video_room_id) {
      return Response.json({ error: 'This battle is not live.' }, { status: 409 });
    }
    const performer = user.id === battle.creator_id || user.id === battle.opponent_id;
    const token = new AccessToken(key, secret, { identity: user.id, name: String(user.display_name || user.full_name || 'Audience').slice(0, 60), ttl: '20m' });
    token.addGrant({
      roomJoin: true,
      room: battle.video_room_id,
      canPublish: performer,
      canPublishData: performer,
      canSubscribe: true,
      roomAdmin: false,
      roomCreate: false,
      roomList: false,
    });
    return Response.json({ ready: true, serverUrl: url, token: await token.toJwt(), role: performer ? 'performer' : 'audience' });
  } catch (error) {
    console.error('joinBattleRoom failed:', error);
    return Response.json({ error: 'Could not join battle room.' }, { status: 500 });
  }
});