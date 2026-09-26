import { RoomServiceClient, AccessToken } from 'npm:livekit-server-sdk@2.19.1';
Deno.serve(async () => {
  const url = Deno.env.get('LIVEKIT_URL') || '';
  const key = Deno.env.get('LIVEKIT_API_KEY') || '';
  const secret = Deno.env.get('LIVEKIT_API_SECRET') || '';
  if (!url || !key || !secret) return Response.json({ success: false, reason: 'missing_configuration' }, { status: 503 });
  const room = new RoomServiceClient(url.replace(/^wss:/,'https:'), key, secret);
  const roomName = 'nali-connection-check-' + crypto.randomUUID();
  try {
    await room.createRoom({ name: roomName, emptyTimeout: 30, maxParticipants: 3 });
    const token = new AccessToken(key, secret, { identity: 'connection-check', ttl: '60s' });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: false, canSubscribe: true });
    const jwt = await token.toJwt();
    if (!jwt || jwt.split('.').length !== 3) throw new Error('Token signing failed');
    await room.listRooms([roomName]);
    return Response.json({ success: true, action: 'livekit_room_and_token_check' });
  } catch (error) {
    console.error('LiveKit room check failed', error);
    return Response.json({ success: false, reason: String(error?.name || 'Error') }, { status: 502 });
  } finally {
    await room.deleteRoom(roomName).catch(error => console.error('Could not delete test room', error));
  }
});