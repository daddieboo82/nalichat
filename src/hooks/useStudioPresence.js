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
  const cancelledRef = useRef(false);
  const accessRef = useRef([]);

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
    if (cancelledRef.current) return;
    const me = meRef.current;
    if (!me) return;
    const currentId = recordRef.current;
    const payload = {
      room_id: roomId,
      user_id: me.id,
      user_name: me.full_name || 'Artist',
      user_avatar: me.avatar_url || '',
      activity: activityRef.current,
      last_heartbeat: new Date().toISOString(),
      access_user_ids: accessRef.current,
    };
    try {
      if (currentId) {
        await base44.entities.StudioPresence.update(currentId, payload);
      } else {
        const created = await base44.entities.StudioPresence.create(payload);
        if (!cancelledRef.current) recordRef.current = created.id;
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
        let accessUserIds = [me.id];
        try {
          const project = await base44.entities.Project.get(roomId);
          accessUserIds = Array.from(new Set([
            project?.owner_id,
            ...(project?.collaborator_ids || []),
            me.id,
          ].filter(Boolean)));
        } catch {
          // Local/private rooms remain visible only to the current user.
        }
        accessRef.current = accessUserIds;

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
      cancelledRef.current = true;
      if (interval) clearInterval(interval);
      if (unsubscribe) unsubscribe();
      // Clear the ref first so no in-flight heartbeat can update a stale record,
      // then delete with a short delay to let any in-flight update settle first.
      const idToDelete = recordRef.current;
      recordRef.current = null;
      if (idToDelete) {
        setTimeout(() => {
          base44.entities.StudioPresence.delete(idToDelete).catch(() => {});
        }, 2000);
      }
    };
  }, [roomId, writeHeartbeat, refresh]);

  return { peers, setActivity };
}