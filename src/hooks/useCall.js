/**
 * useCall — React hook that wraps CallEngine with message-based signaling.
 *
 * Call signaling messages are transported as `type: "session"` Message records
 * whose `text` is a JSON envelope tagged with __nalichat_call__. The hook
 * scans incoming messages (picked up by the existing poller in Messages.jsx)
 * for signals and routes them to the CallEngine.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { CallEngine } from "@/lib/callEngine";
import { toast } from "sonner";

export const SIGNAL_SENTINEL = "__nalichat_call__";

/** How long an outgoing call rings before it is auto-cancelled as unanswered. */
const RING_TIMEOUT_MS = 45000;

/** Returns true if a message text is a call-signaling envelope. */
export function isCallSignal(text) {
  if (!text) return false;
  try {
    const parsed = JSON.parse(text);
    return parsed && parsed[SIGNAL_SENTINEL] === true;
  } catch {
    return false;
  }
}

export function useCall({ conversation, messages, currentUser, otherUser }) {
  const engineRef = useRef(null);
  const [callState, setCallState] = useState(null); // { status, type, callId, direction }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const processedRef = useRef(new Set());
  const pendingOfferRef = useRef(null);
  // Signals for the active callId that arrived before the engine existed.
  const pendingSignalsRef = useRef([]);
  // Auto-cancels an outgoing call that is never answered.
  const ringTimeoutRef = useRef(null);
  const callIdRef = useRef(null);

  const conversationId = conversation?.id;

  // Send a signaling message directly to the backend (bypasses the sendMessage
  // mutation so signaling doesn't update conversation previews or trigger moderation).
  const sendSignal = useCallback(
    async (signal) => {
      if (!conversationId || !currentUser) return;
      try {
        const res = await base44.functions.invoke("sendConversationMessage", {
          conversation_id: conversationId,
          type: "session",
          text: JSON.stringify({ [SIGNAL_SENTINEL]: true, ...signal }),
        });
        if (res?.data?.error) throw new Error(res.data.error);
      } catch (e) {
        console.error("Call signal failed:", e);
        throw e;
      }
    },
    [conversationId, currentUser, conversation]
  );

  // Create or retrieve the engine singleton for this call.
  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new CallEngine({
        onStateChange: (state) => {
          // "failed" (ICE/network drop) and engine-driven "ended" both need to tear
          // the overlay down. Previously only the local user's explicit endCall()
          // nulled callState, so a dropped call left a full-screen overlay stuck on
          // screen with a blank status until the user manually pressed End.
          if (state === "ended" || state === "failed") {
            clearTimeout(ringTimeoutRef.current);
            pendingSignalsRef.current = [];
            setLocalStream(null);
            setRemoteStream(null);
            setMuted(false);
            setVideoEnabled(true);
            engineRef.current = null;
            callIdRef.current = null;
            setCallState(null);
            if (state === "failed") toast.error("Call disconnected");
            return;
          }
          setCallState((prev) => (prev ? { ...prev, status: state } : null));
        },
        onRemoteStream: setRemoteStream,
        onLocalStream: setLocalStream,
        onSignal: sendSignal,
      });
    }
    return engineRef.current;
  }, [sendSignal]);

  // Scan incoming messages for call signals.
  useEffect(() => {
    if (!currentUser || !messages) return;

    for (const msg of messages) {
      if (processedRef.current.has(msg.id)) continue;
      processedRef.current.add(msg.id);

      // Only process session messages from the other user.
      if (msg.sender_id === currentUser.id) continue;
      if (msg.type !== "session" || !msg.text) continue;

      let signal;
      try {
        const parsed = JSON.parse(msg.text);
        if (!parsed[SIGNAL_SENTINEL]) continue;
        signal = parsed;
      } catch {
        continue;
      }

      // Incoming offer — show the incoming-call UI.
      if (signal.type === "offer" && !callIdRef.current) {
        pendingOfferRef.current = signal;
        callIdRef.current = signal.callId;
        setCallState({
          status: "incoming",
          type: signal.callType,
          callId: signal.callId,
          direction: "incoming",
        });
      } else if (signal.type === "end" && callIdRef.current === signal.callId) {
        // Remote party ended the call.
        clearTimeout(ringTimeoutRef.current);
        pendingSignalsRef.current = [];
        engineRef.current?.endCall();
        setCallState(null);
        setLocalStream(null);
        setRemoteStream(null);
        callIdRef.current = null;
      } else if (engineRef.current && signal.callId === engineRef.current.callId) {
        engineRef.current.handleSignal(signal);
      } else if (signal.callId && signal.callId === callIdRef.current) {
        // The engine doesn't exist yet (an incoming call is still ringing, so
        // acceptCall hasn't run). ICE candidates that arrive in this window used
        // to be dropped and, because the message is marked processed, never
        // reprocessed — causing "connected but no audio" on restrictive NATs.
        // Buffer them and replay once the engine is created.
        pendingSignalsRef.current.push(signal);
      }
    }
  }, [messages, currentUser]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      clearTimeout(ringTimeoutRef.current);
      engineRef.current?.endCall();
    };
  }, []);

  // Reset when conversation changes.
  useEffect(() => {
    clearTimeout(ringTimeoutRef.current);
    engineRef.current?.endCall();
    setCallState(null);
    setLocalStream(null);
    setRemoteStream(null);
    callIdRef.current = null;
    pendingOfferRef.current = null;
    pendingSignalsRef.current = [];
    processedRef.current.clear();
  }, [conversationId]);

  const startCall = useCallback(
    async (type) => {
      if (!currentUser) return;
      const callId = `${currentUser.id}-${Date.now()}`;
      callIdRef.current = callId;
      setCallState({ status: "ringing", type, callId, direction: "outgoing" });
      const engine = getEngine();
      try {
        await engine.startCall({ callId, type });
        // Without this, an unanswered call rings forever (the ring tone loops on a
        // 2s interval) with no way out except manually pressing End.
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = setTimeout(() => {
          if (callIdRef.current === callId && engineRef.current?.callId === callId) {
            sendSignal({ type: "end", callId });
            engineRef.current?.endCall();
            setCallState(null);
            setLocalStream(null);
            setRemoteStream(null);
            callIdRef.current = null;
            toast.info("No answer");
          }
        }, RING_TIMEOUT_MS);
      } catch (e) {
        console.error("Failed to start call:", e);
        engineRef.current?.endCall();
        setCallState(null);
        callIdRef.current = null;
        const reason = e?.name === "NotFoundError"
          ? "No microphone or camera was found on this device."
          : e?.name === "NotAllowedError"
            ? "Microphone or camera access was denied. Check your browser permissions."
            : "Couldn't start the call. Please try again.";
        toast.error(reason);
      }
    },
    [currentUser, getEngine]
  );

  const acceptCall = useCallback(async () => {
    const signal = pendingOfferRef.current;
    if (!signal) return;
    clearTimeout(ringTimeoutRef.current);
    const engine = getEngine();
    setCallState((prev) => ({ ...prev, status: "connecting" }));
    try {
      await engine.acceptCall({ callId: signal.callId, type: signal.callType, offer: signal.payload });
      // Replay any ICE candidates that arrived while the call was still ringing.
      const buffered = pendingSignalsRef.current;
      pendingSignalsRef.current = [];
      buffered.forEach(s => {
        if (s.callId === signal.callId) {
          try { engine.handleSignal(s); } catch (err) { console.error('Failed to replay call signal:', err); }
        }
      });
    } catch (e) {
      console.error("Failed to accept call:", e);
      engineRef.current?.endCall();
      setCallState(null);
      callIdRef.current = null;
      pendingOfferRef.current = null;
      pendingSignalsRef.current = [];
      const reason = e?.name === "NotFoundError"
        ? "No microphone or camera was found on this device."
        : e?.name === "NotAllowedError"
          ? "Microphone or camera access was denied. Check your browser permissions."
          : "Couldn't accept the call. Please try again.";
      toast.error(reason);
    }
  }, [getEngine]);

  const declineCall = useCallback(() => {
    clearTimeout(ringTimeoutRef.current);
    sendSignal({ type: "end", callId: callIdRef.current });
    setCallState(null);
    callIdRef.current = null;
    pendingOfferRef.current = null;
    pendingSignalsRef.current = [];
  }, [sendSignal]);

  const endCall = useCallback(() => {
    clearTimeout(ringTimeoutRef.current);
    pendingSignalsRef.current = [];
    engineRef.current?.endCall();
    setCallState(null);
    setLocalStream(null);
    setRemoteStream(null);
    callIdRef.current = null;
  }, []);

  const toggleMute = useCallback(() => {
    const m = engineRef.current?.toggleMute();
    setMuted(m ?? false);
  }, []);

  const toggleVideo = useCallback(() => {
    const v = engineRef.current?.toggleVideo();
    setVideoEnabled(v ?? true);
  }, []);

  return {
    callState,
    localStream,
    remoteStream,
    muted,
    videoEnabled,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}