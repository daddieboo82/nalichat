import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const HEARTBEAT_MS = 15000;
const STALE_MS = 45000; // a peer is considered gone if no heartbeat in this window

// Tracks who else is live in the same studio room, in real time.
// Returns { peers, setActivity } where peers excludes the current user.
export function useStudioPresence(roomId = 'studio-main') {
  const [peers, setPeers] = useState([]);
  const meRef = useRef(null);
  const recordRef = useRef(null);
  const activityRef = useRef('In the studio');

  const filterActive = useCallback((rows) => {
    const now = Date.now();
    const seen = new Set();
    return rows.filter((r) => {
      if (!r.last_heartbeat) return false;
      if (now - new Date(r.last_heartbeat).getTime() > STALE_MS) return false;
      if (meRef.current && r.user_id === meRef.current.id) return false;
      if (seen.has(r.user_id)) return false;
      seen.add(r.user_id);
      return true;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const rows = await base44.entities.StudioPresence.filter({ room_id: roomId }, '-last_heartbeat', 50);
      setPeers(filterActive(rows));
    } catch (e) {
      // non-fatal
    }
  }, [roomId, filterActive]);

  const writeHeartbeat = useCallback(async () => {
    const me = meRef.current;
    if (!me) return;
    const payload = {
      room_id: roomId,
      user_id: me.id,
      user_name: me.full_name || 'Artist',
      user_avatar: me.avatar_url || '',
      activity: activityRef.current,
      last_heartbeat: new Date().toISOString(),
    };
    try {
      if (recordRef.current) {
        await base44.entities.StudioPresence.update(recordRef.current, payload);
      } else {
        const created = await base44.entities.StudioPresence.create(payload);
        recordRef.current = created.id;
      }
    } catch (e) {
      // If update failed (record gone), recreate next tick
      recordRef.current = null;
    }
  }, [roomId]);

  const setActivity = useCallback((label) => {
    activityRef.current = label;
    writeHeartbeat();
  }, [writeHeartbeat]);

  useEffect(() => {
    let interval;
    let unsubscribe;
    let cancelled = false;

    (async () => {
      try {
        const me = await base44.auth.me();
        if (cancelled || !me) return;
        meRef.current = me;

        await writeHeartbeat();
        await refresh();

        interval = setInterval(writeHeartbeat, HEARTBEAT_MS);

        unsubscribe = base44.entities.StudioPresence.subscribe(() => {
          refresh();
        });
      } catch (e) {
        // not logged in — no presence
      }
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (unsubscribe) unsubscribe();
      if (recordRef.current) {
        base44.entities.StudioPresence.delete(recordRef.current).catch(() => {});
      }
    };
  }, [roomId, writeHeartbeat, refresh]);

  return { peers, setActivity };
}