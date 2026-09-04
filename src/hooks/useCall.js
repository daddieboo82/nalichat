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
  const callIdRef = useRef(null);

  const conversationId = conversation?.id;

  // Send a signaling message directly to the backend (bypasses the sendMessage
  // mutation so signaling doesn't update conversation previews or trigger moderation).
  const sendSignal = useCallback(
    async (signal) => {
      if (!conversationId || !currentUser) return;
      try {
        await base44.entities.Message.create({
          conversation_id: conversationId,
          sender_id: currentUser.id,
          sender_name: currentUser.display_name || currentUser.full_name,
          sender_avatar: currentUser.avatar_url,
          participant_ids: conversation?.participant_ids || [],
          type: "session",
          text: JSON.stringify({ [SIGNAL_SENTINEL]: true, ...signal }),
        });
      } catch (e) {
        console.error("Call signal failed:", e);
      }
    },
    [conversationId, currentUser, conversation]
  );

  // Create or retrieve the engine singleton for this call.
  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new CallEngine({
        onStateChange: (state) => {
          setCallState((prev) => (prev ? { ...prev, status: state } : null));
          if (state === "ended") {
            setLocalStream(null);
            setRemoteStream(null);
            setMuted(false);
            setVideoEnabled(true);
            engineRef.current = null;
            callIdRef.current = null;
          }
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
        engineRef.current?.endCall();
        setCallState(null);
        setLocalStream(null);
        setRemoteStream(null);
        callIdRef.current = null;
      } else if (engineRef.current && signal.callId === engineRef.current.callId) {
        engineRef.current.handleSignal(signal);
      }
    }
  }, [messages, currentUser]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      engineRef.current?.endCall();
    };
  }, []);

  // Reset when conversation changes.
  useEffect(() => {
    engineRef.current?.endCall();
    setCallState(null);
    setLocalStream(null);
    setRemoteStream(null);
    callIdRef.current = null;
    pendingOfferRef.current = null;
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
    const engine = getEngine();
    setCallState((prev) => ({ ...prev, status: "connecting" }));
    try {
      await engine.acceptCall({ callId: signal.callId, type: signal.callType, offer: signal.payload });
    } catch (e) {
      console.error("Failed to accept call:", e);
      engineRef.current?.endCall();
      setCallState(null);
      callIdRef.current = null;
      pendingOfferRef.current = null;
      const reason = e?.name === "NotFoundError"
        ? "No microphone or camera was found on this device."
        : e?.name === "NotAllowedError"
          ? "Microphone or camera access was denied. Check your browser permissions."
          : "Couldn't accept the call. Please try again.";
      toast.error(reason);
    }
  }, [getEngine]);

  const declineCall = useCallback(() => {
    sendSignal({ type: "end", callId: callIdRef.current });
    setCallState(null);
    callIdRef.current = null;
    pendingOfferRef.current = null;
  }, [sendSignal]);

  const endCall = useCallback(() => {
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