import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';
Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const client = createClientFromRequest(req);
    const viewer = await client.auth.me().catch(() => null);
    if (!viewer?.id) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    const { battleId } = await req.json();
    if (typeof battleId !== 'string' || !/^[a-z0-9_-]{10,80}$/i.test(battleId)) return Response.json({ error: 'Invalid battle.' }, { status: 400 });
    const battle = await client.asServiceRole.entities.LiveBattle.get(battleId).catch(() => null);
    if (!battle?.video_room_id || !['live','voting'].includes(battle.status)) return Response.json({ error: 'Battle is not live.' }, { status: 409 });
    const url = Deno.env.get('LIVEKIT_URL') || '';
    const key = Deno.env.get('LIVEKIT_API_KEY') || '';
    const secret = Deno.env.get('LIVEKIT_API_SECRET') || '';
    if (!url || !key || !secret) return Response.json({ error: 'Video unavailable.' }, { status: 503 });
    const room = new RoomServiceClient(url.replace(/^wss:/,'https:'), key, secret);
    const participants = await room.listParticipants(battle.video_room_id);
    const performers = new Set([battle.creator_id, battle.opponent_id]);
    return Response.json({ success: true, audienceCount: participants.filter(p => !performers.has(p.identity)).length, performersOnline: participants.filter(p => performers.has(p.identity)).length });
  } catch (error) {
    console.error('getBattleAudienceCount failed', error);
    return Response.json({ error: 'Could not load audience count.' }, { status: 500 });
  }
});