import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { AccessToken, RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const validId = value => typeof value === 'string' && /^[a-z0-9_-]{10,80}$/i.test(value);
const validCode = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{30,80}$/.test(value);
const newCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).split('+').join('-').split('/').join('_').replace(/=+$/, '');
};
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(n => n.toString(16).padStart(2, '0')).join('');
const publicRoom = row => ({
  id: row.id, title: row.title, kind: row.kind, host_name: row.host_name,
  artist_name: row.artist_name || '', track_url: row.track_url || '', agenda: row.agenda || '', starts_at: row.starts_at,
  status: row.status, notes: undefined
});
const error = (message, status) => Response.json({ error: message }, { status });

Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return error('Method not allowed.', 405);
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return error('Sign in to use meeting rooms.', 401);
    if (user.is_banned || (user.timeout_until && Date.parse(user.timeout_until) > Date.now())) return error('Meeting access is unavailable for this account.', 403);
    const body = await req.json().catch(() => ({}));
    const entities = client.asServiceRole.entities;
    if (body.action === 'list') {
      const rows = await entities.MeetingRoom.filter({ host_id: user.id }, '-created_date', 40);
      return Response.json({ rooms: rows.map(row => ({ ...publicRoom(row), notes: row.notes || '' })) });
    }
    if (body.action === 'create') {
      const title = String(body.title || '').trim().slice(0, 100);
      const artist = String(body.artistName || '').trim().slice(0, 80);
      const agenda = String(body.agenda || '').trim().slice(0, 1200);
      const trackUrl = String(body.trackUrl || '').trim();
      if (trackUrl && (trackUrl.length > 1000 || !/^https:\/\/[^\s/]+\//i.test(trackUrl) || /https:\/\/(localhost|127\.|0\.0\.0\.0|\[)/i.test(trackUrl))) return error('Use a public HTTPS track link.', 400);
      const kind = body.kind === 'listening' ? 'listening' : body.kind === 'business' ? 'business' : null;
      const start = new Date(body.startsAt);
      if (title.length < 3 || !kind || !Number.isFinite(start.getTime()) || start.getTime() < Date.now() - 3600000 || start.getTime() > Date.now() + 366 * 86400000) return error('Check the title, meeting type, and start time.', 400);
      const rate = await consumeHourlyLimit(entities, user.id, 'meeting_create', 8);
      if (!rate.allowed) return error('Meeting creation limit reached. Try again later.', 429);
      const code = newCode();
      const row = await entities.MeetingRoom.create({
        title, kind, artist_name: artist, track_url: trackUrl, agenda, starts_at: start.toISOString(),
        host_id: user.id, host_name: String(user.display_name || user.full_name || 'Host').slice(0, 60),
        status: 'scheduled', invite_hash: await hash(code), room_name: 'nali-meeting-' + crypto.randomUUID()
      });
      return Response.json({ room: publicRoom(row), inviteCode: code });
    }
    if (!validId(body.roomId)) return error('Invalid room.', 400);
    const row = await entities.MeetingRoom.get(body.roomId).catch(() => null);
    if (!row) return error('Room not found.', 404);
    const host = row.host_id === user.id;
    const allowed = host || (validCode(body.inviteCode) && await hash(body.inviteCode) === row.invite_hash);
    if (!allowed) return error('This private room requires its invitation link.', 403);
    if (body.action === 'details') return Response.json({ room: { ...publicRoom(row), ...(host ? { notes: row.notes || '' } : {}) }, host });
    if (body.action === 'rotate') {
      if (!host || row.status === 'ended') return error('Only the host can replace the invitation.', 403);
      const code = newCode();
      await entities.MeetingRoom.update(row.id, { invite_hash: await hash(code) });
      return Response.json({ inviteCode: code });
    }
    if (body.action === 'notes') {
      if (!host) return error('Only the host can save decision notes.', 403);
      const notes = String(body.notes || '').slice(0, 4000);
      await entities.MeetingRoom.update(row.id, { notes });
      return Response.json({ success: true });
    }
    if (body.action === 'start' || body.action === 'end') {
      if (!host) return error('Only the host can manage this meeting.', 403);
      if (body.action === 'start') {
        if (row.status !== 'scheduled') return error('This meeting cannot be started.', 409);
        const url = Deno.env.get('LIVEKIT_URL');
        const key = Deno.env.get('LIVEKIT_API_KEY');
        const secret = Deno.env.get('LIVEKIT_API_SECRET');
        if (!url || !key || !secret || !/^wss:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url)) return error('Live video setup is unavailable.', 503);
        try {
          const service = new RoomServiceClient(url.replace(/^wss:/, 'https:'), key, secret);
          await service.listRooms([]);
        } catch { return error('Could not reach live video. Try again shortly.', 503); }
        await entities.MeetingRoom.update(row.id, { status: 'live' });
        return Response.json({ success: true, status: 'live' });
      }
      if (row.status === 'ended') return error('This meeting has already ended.', 409);
      await entities.MeetingRoom.update(row.id, { status: 'ended' });
      const url = Deno.env.get('LIVEKIT_URL');
      const key = Deno.env.get('LIVEKIT_API_KEY');
      const secret = Deno.env.get('LIVEKIT_API_SECRET');
      if (url && key && secret) {
        const service = new RoomServiceClient(url.replace(/^wss:/, 'https:'), key, secret);
        await service.deleteRoom(row.room_name).catch(() => {});
      }
      return Response.json({ success: true, status: 'ended' });
    }
    if (body.action === 'join') {
      if (row.status !== 'live') return error('The host has not opened this room.', 409);
      const key = Deno.env.get('LIVEKIT_API_KEY');
      const secret = Deno.env.get('LIVEKIT_API_SECRET');
      const url = Deno.env.get('LIVEKIT_URL');
      if (!key || !secret || !url || !/^wss:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url)) return error('Live video setup is unavailable.', 503);
      const token = new AccessToken(key, secret, {
        identity: user.id, name: String(user.display_name || user.full_name || 'Guest').slice(0, 60), ttl: '10m'
      });
      token.addGrant({ roomJoin: true, room: row.room_name, canPublish: true, canPublishData: true, canSubscribe: true, roomAdmin: false, roomCreate: false, roomList: false });
      return Response.json({ serverUrl: url, token: await token.toJwt(), host });
    }
    return error('Invalid action.', 400);
  } catch (e) {
    console.error('meetingHub failed:', e);
    return error('Meeting request failed. Please retry.', 500);
  }
});