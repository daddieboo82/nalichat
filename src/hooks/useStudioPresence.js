import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const HEARTBEAT_MS = 15000;
const STALE_MS = 45000; // a peer is considered gone if no heartbeat in this window

// Tracks who else is live in the same studio room, in real time.
// Returns { peers, setActivity } where peers excludes the current user.
export function useStudioPresence(roomId = 'local_studio') {
  const { user } = useAuth();
  const [peers, setPeers] = useState([]);
  const meRef = useRef(null);
  const activityRef = useRef('In the studio');
  const cancelledRef = useRef(false);
  const refreshGenerationRef = useRef(0);

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

  const refresh = useCallback(async (generation = refreshGenerationRef.current) => {
    try {
      const rows = await base44.entities.StudioPresence.filter({ room_id: roomId }, '-last_heartbeat', 50);
      if (generation !== refreshGenerationRef.current || cancelledRef.current) return;
      setPeers(filterActive(rows));
    } catch (e) {
      // non-fatal
    }
  }, [roomId, filterActive]);

  const writeHeartbeat = useCallback(async () => {
    if (cancelledRef.current) return;
    const me = meRef.current;
    if (!me) return;
    try {
      const res = await base44.functions.invoke("updateStudioPresence", {
        action: "heartbeat",
        roomId,
        activity: activityRef.current,
      });
      if (
        res?.data?.error ||
        res?.data?.success !== true ||
        res?.data?.action !== "heartbeat" ||
        res?.data?.userId !== me.id ||
        res?.data?.roomId !== roomId ||
        res?.data?.presence?.user_id !== me.id ||
        res?.data?.presence?.room_id !== roomId
      ) {
        throw new Error(res?.data?.error || "Studio presence update was not confirmed.");
      }
    } catch (e) {
      // Presence is non-critical; retry on the next heartbeat.
    }
  }, [roomId]);

  const setActivity = useCallback((label) => {
    activityRef.current = label;
    writeHeartbeat();
  }, [writeHeartbeat]);

  useEffect(() => {
    let interval;
    let refreshInterval;

    cancelledRef.current = false;
    const generation = ++refreshGenerationRef.current;
    meRef.current = user || null;

    if (user?.id) {
      void (async () => {
        await writeHeartbeat();
        await refresh(generation);
        if (cancelledRef.current || generation !== refreshGenerationRef.current) return;
        interval = setInterval(writeHeartbeat, HEARTBEAT_MS);
        refreshInterval = setInterval(() => refresh(generation), 5000);
      })();
    } else {
      setPeers([]);
    }

    return () => {
      cancelledRef.current = true;
      refreshGenerationRef.current += 1;
      if (interval) clearInterval(interval);
      if (refreshInterval) clearInterval(refreshInterval);
      if (user?.id) {
        void base44.functions.invoke("updateStudioPresence", {
          action: "clear",
          roomId,
        }).catch(() => {});
      }
    };
  }, [roomId, user, writeHeartbeat, refresh]);

  return { peers, setActivity };
}