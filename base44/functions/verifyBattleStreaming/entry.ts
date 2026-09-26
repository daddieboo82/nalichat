import { RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';
Deno.serve(async () => {
  const url = Deno.env.get('LIVEKIT_URL') || '';
  const key = Deno.env.get('LIVEKIT_API_KEY') || '';
  const secret = Deno.env.get('LIVEKIT_API_SECRET') || '';
  if (!url || !key || !secret) return Response.json({ configured: false, reachable: false });
  try {
    const host = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const service = new RoomServiceClient(host, key, secret);
    await service.listRooms([]);
    return Response.json({ configured: true, reachable: true });
  } catch (error) {
    console.error('LiveKit connection check failed', error);
    return Response.json({ configured: true, reachable: false });
  }
});