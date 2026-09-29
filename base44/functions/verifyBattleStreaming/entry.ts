import { RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';
import { getLiveKitConfig } from '../../shared/livekitConfig.ts';
Deno.serve(async () => {
  const { configured, httpHost, key, secret } = getLiveKitConfig();
  if (!configured) return Response.json({ configured: false, reachable: false });
  try {
    const service = new RoomServiceClient(httpHost, key, secret);
    await service.listRooms([]);
    return Response.json({ configured: true, reachable: true });
  } catch (error) {
    console.error('LiveKit connection check failed', error);
    return Response.json({ configured: true, reachable: false, errorType: String(error?.name || 'Error'), status: Number(error?.status || error?.statusCode || 0) || null });
  }
});