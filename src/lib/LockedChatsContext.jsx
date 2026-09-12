import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/lib/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import {
  completeLockedChatPinReset,
  configureLockedChatPin,
  getLockedChatState,
  requestLockedChatPinReset,
  setLockedConversation,
  verifyLockedChatPin,
} from "@/lib/lockedChatClient";

export const LOCKED_CHAT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const LOCK_SIGNAL_KEY = "nali:locked-chat-lock-signal";
const LockedChatsContext = createContext(null);

export function LockedChatsProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const { hasEntitlement } = useSubscription();
  const [state, setState] = useState({
    status: "loading",
    lockedConversationIds: [],
    security: null,
    error: null,
  });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const timeoutRef = useRef(null);
  const broadcastRef = useRef(null);
  const lockGenerationRef = useRef(0);
  const refreshGenerationRef = useRef(0);

  const lockNow = useCallback(() => {
    lockGenerationRef.current += 1;
    setIsUnlocked(false);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const broadcastLock = useCallback(() => {
    lockNow();
    broadcastRef.current?.postMessage({ type: "lock" });
    try {
      localStorage.setItem(LOCK_SIGNAL_KEY, `lock:${Date.now()}`);
      localStorage.removeItem(LOCK_SIGNAL_KEY);
    } catch {
      // Cross-tab locking still works through BroadcastChannel when available.
    }
  }, [lockNow]);

  const broadcastStateChange = useCallback(() => {
    broadcastRef.current?.postMessage({ type: "state_changed" });
    try {
      localStorage.setItem(LOCK_SIGNAL_KEY, `state:${Date.now()}`);
      localStorage.removeItem(LOCK_SIGNAL_KEY);
    } catch {
      // Other tabs still receive BroadcastChannel where supported.
    }
  }, []);

  const refresh = useCallback(async () => {
    const generation = ++refreshGenerationRef.current;
    const userId = user?.id;
    if (!isAuthenticated || !user?.id) {
      setState({
        status: "ready",
        lockedConversationIds: [],
        security: null,
        error: null,
      });
      return;
    }
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const next = await getLockedChatState();
      if (generation !== refreshGenerationRef.current || userId !== user?.id) return;
      setState({
        status: "ready",
        lockedConversationIds: next.lockedConversationIds || [],
        security: next.security || null,
        error: null,
      });
    } catch (error) {
      if (generation !== refreshGenerationRef.current || userId !== user?.id) return;
      lockNow();
      setState({
        status: "error",
        lockedConversationIds: [],
        security: null,
        error,
      });
    }
  }, [isAuthenticated, lockNow, user?.id]);

  useEffect(() => {
    lockNow();
    refresh();
  }, [lockNow, refresh, user?.id]);

  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("nali-locked-chat-vault");
      channel.onmessage = (event) => {
        if (event.data?.type === "state_changed") {
          lockNow();
          refresh();
        } else if (event.data?.type === "lock") {
          lockNow();
        }
      };
      broadcastRef.current = channel;
    }
    const handleStorage = (event) => {
      if (event.key !== LOCK_SIGNAL_KEY || !event.newValue) return;
      lockNow();
      if (event.newValue.startsWith("state:")) refresh();
    };
    const handleLockEvent = () => broadcastLock();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("nali-lock-vault", handleLockEvent);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("nali-lock-vault", handleLockEvent);
      broadcastRef.current?.close();
      broadcastRef.current = null;
    };
  }, [broadcastLock, lockNow, refresh]);

  useEffect(() => {
    if (!isUnlocked) return undefined;
    const scheduleRelock = () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(broadcastLock, LOCKED_CHAT_IDLE_TIMEOUT_MS);
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") broadcastLock();
    };
    const activityEvents = ["pointerdown", "keydown", "touchstart"];
    if (document.visibilityState !== "visible") {
      broadcastLock();
      return undefined;
    }
    activityEvents.forEach((event) => window.addEventListener(event, scheduleRelock, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", broadcastLock);
    scheduleRelock();
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      activityEvents.forEach((event) => window.removeEventListener(event, scheduleRelock));
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", broadcastLock);
    };
  }, [broadcastLock, isUnlocked]);

  const setupPin = useCallback(async (pin) => {
    const generation = lockGenerationRef.current;
    const result = await configureLockedChatPin(pin);
    if (generation !== lockGenerationRef.current || document.visibilityState !== "visible") {
      throw new Error("Locked chats were relocked before verification completed.");
    }
    setState((current) => ({ ...current, security: result.security }));
    if (generation !== lockGenerationRef.current || document.visibilityState !== "visible") {
      throw new Error("Locked chats were relocked before verification completed.");
    }
    setIsUnlocked(true);
    return result;
  }, []);

  const unlock = useCallback(async (pin) => {
    if (!state.security?.configured) throw new Error("Set up a PIN before unlocking chats.");
    const generation = lockGenerationRef.current;
    const result = await verifyLockedChatPin(pin, state.security);
    if (generation !== lockGenerationRef.current || document.visibilityState !== "visible") {
      throw new Error("Locked chats were relocked before verification completed.");
    }
    setIsUnlocked(true);
    return result;
  }, [state.security]);

  const updateConversationLock = useCallback(async (conversationId, locked) => {
    const generation = lockGenerationRef.current;
    const result = await setLockedConversation(conversationId, locked);
    if (generation !== lockGenerationRef.current) {
      throw new Error("Locked chats changed accounts before the update completed.");
    }
    setState((current) => ({
      ...current,
      lockedConversationIds: result.lockedConversationIds || [],
    }));
    broadcastStateChange();
    return result;
  }, [broadcastStateChange]);

  const requestPinReset = useCallback(() => requestLockedChatPinReset(), []);

  const completePinReset = useCallback(async (code, pin) => {
    const generation = lockGenerationRef.current;
    const result = await completeLockedChatPinReset(code, pin);
    if (generation !== lockGenerationRef.current || document.visibilityState !== "visible") {
      throw new Error("Locked chats were relocked before verification completed.");
    }
    setState((current) => ({ ...current, security: result.security }));
    broadcastStateChange();
    if (generation !== lockGenerationRef.current || document.visibilityState !== "visible") {
      throw new Error("Locked chats were relocked before verification completed.");
    }
    setIsUnlocked(true);
    return result;
  }, [broadcastStateChange]);

  const lockedIdSet = useMemo(
    () => new Set(state.lockedConversationIds),
    [state.lockedConversationIds],
  );

  const value = useMemo(() => ({
    ...state,
    isReady: state.status === "ready",
    isUnlocked,
    isEntitled: hasEntitlement("privacy.locked_chats"),
    hasLockedChats: state.lockedConversationIds.length > 0,
    isConversationLocked: (conversationId) => lockedIdSet.has(conversationId),
    canAccessConversation: (conversationId) =>
      state.status === "ready" && (!lockedIdSet.has(conversationId) || isUnlocked),
    lockNow: broadcastLock,
    refresh,
    setupPin,
    unlock,
    updateConversationLock,
    requestPinReset,
    completePinReset,
  }), [
    state,
    isUnlocked,
    hasEntitlement,
    lockedIdSet,
    broadcastLock,
    refresh,
    setupPin,
    unlock,
    updateConversationLock,
    requestPinReset,
    completePinReset,
  ]);

  return <LockedChatsContext.Provider value={value}>{children}</LockedChatsContext.Provider>;
}

export function useLockedChats() {
  const context = useContext(LockedChatsContext);
  if (!context) throw new Error("useLockedChats must be used within LockedChatsProvider");
  return context;
}
