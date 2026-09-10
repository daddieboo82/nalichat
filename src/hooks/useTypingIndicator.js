// Typing indicator for chat.
//
// ChatView has always rendered a "... typing" row, but `typingUsers` was only ever
// cleared and never populated, so the indicator could not appear and no typing
// signal was ever broadcast. This hook supplies both halves.
//
// It deliberately writes to a dedicated TypingStatus entity rather than to
// Conversation: Messages.jsx subscribes to Conversation and invalidates the
// "conversations" query on every event, so putting keystroke-rate writes there
// would trigger a refetch storm for every participant.
//
// Writes are throttled and heartbeat-based; readers treat rows older than
// STALE_MS as "stopped typing", so a dropped connection can't wedge the
// indicator on forever. Every backend call is failure-tolerant: if the entity
// isn't deployed the indicator simply stays hidden, matching today's behavior.

import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const THROTTLE_MS = 3000; // at most one write per user per 3s of continuous typing
const STALE_MS = 6000;    // a row older than this is treated as no longer typing
const SWEEP_MS = 2000;    // how often we re-evaluate staleness locally

export function useTypingIndicator(conversationId, currentUser, participantIds = []) {
  const [typingUsers, setTypingUsers] = useState([]);
  const rowIdRef = useRef(null);
  const lastSentRef = useRef(0);
  const rowsRef = useRef(new Map()); // user_id -> { user_name, at }
  const supportedRef = useRef(true);
  const convIdRef = useRef(conversationId);

  useEffect(() => { convIdRef.current = conversationId; }, [conversationId]);

  // Reset when switching conversations so one chat's typists never leak into another.
  useEffect(() => {
    rowsRef.current = new Map();
    setTypingUsers([]);
    rowIdRef.current = null;
    lastSentRef.current = 0;
  }, [conversationId]);

  const applyRows = useCallback(() => {
    const now = Date.now();
    const fresh = [];
    rowsRef.current.forEach((value, userId) => {
      if (now - value.at <= STALE_MS) fresh.push({ id: userId, display_name: value.user_name });
      else rowsRef.current.delete(userId);
    });
    setTypingUsers(prev => {
      const same = prev.length === fresh.length && prev.every(p => fresh.some(f => f.id === p.id));
      return same ? prev : fresh;
    });
  }, []);

  const ingest = useCallback((row) => {
    if (!row || !currentUser) return;
    if (row.conversation_id !== convIdRef.current) return;
    if (row.user_id === currentUser.id) return; // never show yourself
    const at = row.last_typed_at ? new Date(row.last_typed_at).getTime() : Date.now();
    if (Number.isNaN(at)) return;
    rowsRef.current.set(row.user_id, { user_name: row.user_name || 'Someone', at });
    applyRows();
  }, [applyRows, currentUser]);

  // Subscribe to other participants' typing rows.
  useEffect(() => {
    if (!conversationId || !currentUser || !supportedRef.current) return;
    let unsub = null;
    let cancelled = false;

    (async () => {
      try {
        const existing = await base44.entities.TypingStatus.filter({ conversation_id: conversationId });
        if (cancelled) return;
        (existing || []).forEach(ingest);
        const mine = (existing || []).find(r => r.user_id === currentUser.id);
        if (mine) rowIdRef.current = mine.id;
      } catch {
        // Entity not available - degrade to no indicator rather than breaking chat.
        supportedRef.current = false;
        return;
      }
      if (cancelled) return;
      try {
        unsub = base44.entities.TypingStatus.subscribe((event) => {
          if (event?.data) ingest(event.data);
        });
      } catch {
        supportedRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      try { unsub?.(); } catch { /* already gone */ }
    };
  }, [conversationId, currentUser, ingest]);

  // Locally expire stale rows even when no new events arrive.
  useEffect(() => {
    const id = setInterval(applyRows, SWEEP_MS);
    return () => clearInterval(id);
  }, [applyRows]);

  // Broadcast that the local user is typing (throttled).
  const notifyTyping = useCallback(() => {
    if (!conversationId || !currentUser || !supportedRef.current) return;
    const now = Date.now();
    if (now - lastSentRef.current < THROTTLE_MS) return;
    lastSentRef.current = now;

    const payload = {
      conversation_id: conversationId,
      user_id: currentUser.id,
      user_name: currentUser.display_name || currentUser.full_name || 'Someone',
      participant_ids: participantIds,
      last_typed_at: new Date().toISOString(),
    };

    const write = rowIdRef.current
      ? base44.entities.TypingStatus.update(rowIdRef.current, payload)
      : base44.entities.TypingStatus.create(payload).then(row => { rowIdRef.current = row?.id || null; });

    Promise.resolve(write).catch(() => {
      // A failed heartbeat is not worth interrupting the user over; retry on the
      // next keystroke, and drop the cached row id in case it was deleted.
      rowIdRef.current = null;
      lastSentRef.current = 0;
    });
  }, [conversationId, currentUser, participantIds]);

  // Clear our row when leaving the conversation so we don't appear stuck typing.
  useEffect(() => {
    return () => {
      const id = rowIdRef.current;
      if (!id) return;
      rowIdRef.current = null;
      try { base44.entities.TypingStatus.delete(id).catch(() => {}); } catch { /* ignore */ }
    };
  }, [conversationId]);

  return { typingUsers, notifyTyping };
}
