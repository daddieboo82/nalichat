import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';
import { getLiveKitConfig } from '../../shared/livekitConfig.ts';
Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const client = createClientFromRequest(req);
  const user = await client.auth.me().catch(() => null);
  if (!user?.id || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
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