import { useCallback, useEffect, useRef, useState } from "react";
import { authorizedUpload } from "@/lib/authorizedUpload";
import { createAiRequestKey } from "@/lib/aiUsage";
import {
  CALL_SUMMARY_POLL_MS,
  callSummaryError,
  invokeCallSummary,
} from "@/lib/callSummaryClient";
import { canUploadCallCapture, shouldCaptureCallSummary } from "@/lib/callSummaryCapture";
import { useSubscription } from "@/hooks/useSubscription";

const MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function captureFile(chunks, mimeType, sessionId) {
  const type = mimeType || "audio/webm";
  const extension = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
  const blob = new Blob(chunks, { type });
  return new File([blob], `call-${sessionId}.${extension}`, { type });
}

export function useCallSummary({
  callState,
  callEndReason,
  localStream,
  conversation,
  currentUser,
  enabled = true,
}) {
  const { hasEntitlement, isLoading: subscriptionLoading } = useSubscription();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const captureStartedAtRef = useRef(null);
  const uploadPromiseRef = useRef(Promise.resolve());
  const completeUploadRef = useRef(null);
  const lastCallRef = useRef(null);
  const endingRef = useRef(false);
  const dataRef = useRef(null);
  const refreshInFlightRef = useRef(false);

  const entitled = hasEntitlement("calls.summary");
  dataRef.current = data;
  if (callState?.callId) lastCallRef.current = callState;

  const applyData = useCallback((next) => {
    if (next?.session) {
      setData(next);
      setError(null);
    }
    return next;
  }, []);

  const refresh = useCallback(async () => {
    const activeCallId = callState?.callId;
    const isCurrentSession = !activeCallId || dataRef.current?.session?.call_id === activeCallId;
    const callId = activeCallId || dataRef.current?.session?.call_id;
    const sessionId = isCurrentSession ? dataRef.current?.session?.id : null;
    if (!callId && !sessionId) return null;
    if (refreshInFlightRef.current) return null;
    refreshInFlightRef.current = true;
    try {
      return applyData(await invokeCallSummary("get", {
        call_id: callId,
        session_id: sessionId,
      }));
    } catch (requestError) {
      const details = requestError.callSummary || callSummaryError(requestError);
      if (details.code !== "CALL_SUMMARY_NOT_FOUND") setError(details);
      return null;
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [applyData, callState?.callId]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!callState?.callId && !data?.session?.id) return undefined;
    refresh();
    const interval = setInterval(refresh, CALL_SUMMARY_POLL_MS);
    return () => clearInterval(interval);
  }, [callState?.callId, data?.session?.id, enabled, refresh]);

  useEffect(() => {
    const loadedConversationId = dataRef.current?.session?.conversation_id;
    if (
      !enabled
      || callState?.callId
      || (loadedConversationId && loadedConversationId !== conversation?.id)
      || loadedConversationId === conversation?.id
      || !conversation?.id
    ) return;
    invokeCallSummary("list", { conversation_id: conversation.id })
      .then(applyData)
      .catch((requestError) => {
        const details = requestError.callSummary || callSummaryError(requestError);
        if (details.code !== "CALL_SUMMARY_NOT_FOUND") setError(details);
      });
  }, [
    applyData,
    callState?.callId,
    conversation?.id,
    data?.session?.conversation_id,
    enabled,
  ]);

  const pauseForCaptureFailure = useCallback(async (reason) => {
    const sessionId = dataRef.current?.session?.id;
    if (!sessionId) return;
    try {
      applyData(await invokeCallSummary("pause", { session_id: sessionId, reason }));
    } catch (requestError) {
      setError(requestError.callSummary || callSummaryError(requestError));
    }
  }, [applyData]);

  const stopCapture = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return uploadPromiseRef.current;
    recorder.stop();
    setCapturing(false);
    return uploadPromiseRef.current;
  }, []);

  useEffect(() => {
    const shouldCapture = shouldCaptureCallSummary({
      callStatus: callState?.status,
      captureAllowed: data?.capture_allowed,
      localStream,
    });
    if (!shouldCapture) {
      stopCapture();
      return undefined;
    }
    if (recorderRef.current?.state === "recording") return undefined;
    if (typeof MediaRecorder === "undefined") {
      pauseForCaptureFailure("capture_unavailable");
      return undefined;
    }

    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
    let recorder;
    try {
      recorder = new MediaRecorder(
        new MediaStream(localStream.getAudioTracks()),
        mimeType ? { mimeType } : undefined,
      );
    } catch {
      pauseForCaptureFailure("capture_unavailable");
      return undefined;
    }

    chunksRef.current = [];
    captureStartedAtRef.current = new Date().toISOString();
    uploadPromiseRef.current = new Promise((resolve) => {
      completeUploadRef.current = resolve;
    });
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const stoppedAt = new Date().toISOString();
      const sessionId = dataRef.current?.session?.id;
      const startedAt = captureStartedAtRef.current;
      recorderRef.current = null;
      if (
        !sessionId
        || !startedAt
        || chunksRef.current.length === 0
        || !canUploadCallCapture(dataRef.current, currentUser?.id)
      ) {
        chunksRef.current = [];
        completeUploadRef.current?.();
        completeUploadRef.current = null;
        return;
      }
      const file = captureFile(chunksRef.current, recorder.mimeType, sessionId);
      chunksRef.current = [];
      (async () => {
        try {
          const uploaded = await authorizedUpload(file, { accept: "audio" });
          const next = await invokeCallSummary("register_capture", {
            session_id: sessionId,
            audio_url: uploaded.file_url,
            mime_type: file.type,
            byte_size: file.size,
            capture_started_at: startedAt,
            capture_ended_at: stoppedAt,
          });
          applyData(next);
        } catch (requestError) {
          setError(requestError.callSummary || callSummaryError(requestError));
          await pauseForCaptureFailure("capture_failed");
        } finally {
          completeUploadRef.current?.();
          completeUploadRef.current = null;
        }
      })();
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setCapturing(true);
    return () => {
      if (recorder.state !== "inactive") recorder.stop();
      setCapturing(false);
    };
  }, [
    applyData,
    callState?.status,
    data?.capture_allowed,
    localStream,
    pauseForCaptureFailure,
    stopCapture,
    currentUser?.id,
  ]);

  const requestConsent = useCallback(async () => {
    if (!callState?.callId || !conversation?.id) return;
    if (!enabled) return;
    setBusy(true);
    try {
      applyData(await invokeCallSummary("start", {
        call_id: callState.callId,
        conversation_id: conversation.id,
        accept_terms: true,
      }));
    } catch (requestError) {
      setError(requestError.callSummary || callSummaryError(requestError));
    } finally {
      setBusy(false);
    }
  }, [applyData, callState?.callId, conversation?.id, enabled]);

  const respondConsent = useCallback(async (decision) => {
    const sessionId = dataRef.current?.session?.id;
    if (!sessionId) return;
    setBusy(true);
    try {
      applyData(await invokeCallSummary("consent", { session_id: sessionId, decision }));
    } catch (requestError) {
      setError(requestError.callSummary || callSummaryError(requestError));
    } finally {
      setBusy(false);
    }
  }, [applyData]);

  const finishCall = useCallback(async (reason = "ended") => {
    const sessionId = dataRef.current?.session?.id;
    if (!sessionId || endingRef.current) return;
    endingRef.current = true;
    try {
      await stopCapture();
      applyData(await invokeCallSummary("end", { session_id: sessionId, reason }));
    } catch (requestError) {
      setError(requestError.callSummary || callSummaryError(requestError));
    } finally {
      endingRef.current = false;
    }
  }, [applyData, stopCapture]);

  useEffect(() => {
    if (callState) return;
    const previous = lastCallRef.current;
    if (!previous || !dataRef.current?.session?.id) return;
    finishCall(callEndReason === "call_failed" ? "call_failed" : "ended");
    lastCallRef.current = null;
  }, [callEndReason, callState, finishCall]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    };
  }, []);

  useEffect(() => {
    if (
      callState?.callId
      && data?.session?.call_id
      && callState.callId !== data.session.call_id
    ) {
      setData(null);
      setError(null);
    }
  }, [callState?.callId, data?.session?.call_id]);

  useEffect(() => {
    if (data?.session?.conversation_id && data.session.conversation_id !== conversation?.id) {
      setData(null);
      setError(null);
    }
  }, [conversation?.id, data?.session?.conversation_id]);

  const generate = useCallback(async () => {
    const session = dataRef.current?.session;
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      applyData(await invokeCallSummary("generate", {
        session_id: session.id,
        request_key: createAiRequestKey(
          "call_summary",
          `${session.id}:${(dataRef.current?.summary?.attempts || 0) + 1}`,
        ),
      }));
    } catch (requestError) {
      setError(requestError.callSummary || callSummaryError(requestError));
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [applyData, refresh]);

  const deleteSummary = useCallback(async () => {
    const sessionId = dataRef.current?.session?.id;
    if (!sessionId) return;
    setBusy(true);
    try {
      await invokeCallSummary("delete", { session_id: sessionId });
      setData(null);
      setError(null);
    } catch (requestError) {
      setError(requestError.callSummary || callSummaryError(requestError));
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    data,
    error,
    busy,
    capturing,
    entitled,
    subscriptionLoading,
    currentUserId: currentUser?.id,
    requestConsent,
    respondConsent,
    finishCall,
    generate,
    deleteSummary,
    refresh,
  };
}
