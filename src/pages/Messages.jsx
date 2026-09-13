import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { recordSquadActivity } from "@/lib/squadBonus";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import ConversationList from "@/components/messages/ConversationList";
import ContactsTab from "@/components/messages/ContactsTab";
import ChatView from "@/components/messages/ChatView";
import NewChatDialog from "@/components/messages/NewChatDialog";
import GroupChatDialog from "@/components/messages/GroupChatDialog";
import ExternalMessageDialog from "@/components/messages/ExternalMessageDialog";
import GlobalInviteDialog from "@/components/GlobalInviteDialog";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { toast } from "sonner";
import ModerationBanner from "@/components/messages/ModerationBanner";
import { MessageSquare, Users, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createClientMessageKey, applyQueuedMessage, applySendSuccess, applySendFailure, removeClientMessage } from "@/lib/messageCache";
import {
  createOutboundEntry,
  enqueueOutbound,
  flushOutboundQueue,
  getBackoffDelay,
  getNextRetryAt,
  markOutboundForRetry,
  queueEntryToMessage,
  readOutboundQueue,
} from "@/lib/outboundQueue";
import { useSubscription } from "@/hooks/useSubscription";
import { CHAT_THEME_ENTITLEMENT, getChatTheme, resolveEffectiveChatThemeId } from "@/lib/chatThemes";
import { useLockedChats } from "@/lib/LockedChatsContext";
import { useAuth } from "@/lib/AuthContext";
import { partitionUserConversations, resolveRequestedConversation } from "@/lib/lockedChatPolicy";
import LockedChatAccessDialog from "@/components/messages/LockedChatAccessDialog";

async function messageEditRequestKey(messageId, text) {
  const input = new TextEncoder().encode(`${messageId}:${text}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `edit-${hex}`;
}

function inferSendErrorStatus(errorMessage, response) {
  const explicit = Number(response?.status || response?.data?.status);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const text = String(errorMessage || "").toLowerCase();
  if (
    text === "timed_out"
    || text === "banned"
    || text.includes("forbidden")
    || text.includes("unauthorized")
  ) return text.includes("unauthorized") ? 401 : 403;
  if (text.includes("rate limit")) return 429;
  if (
    text.includes("required")
    || text.includes("invalid")
    || text.includes("must ")
    || text.includes("not in this conversation")
    || text.includes("not found")
    || text.includes("too large")
    || text.includes("characters or fewer")
    || text.includes("unsupported")
    || text.includes("could not verify message attachment size")
  ) return 400;
  return 500;
}

function sendErrorFromResponse(response) {
  const message = response?.data?.error;
  const error = new Error(message || "Message send failed");
  error.status = inferSendErrorStatus(message, response);
  error.code = response?.data?.code;
  return error;
}

async function filterAll(entity, query, sort, pageSize = 200) {
  const rows = [];
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.filter(query, sort, pageSize, skip);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function updateMessageHistory(cache, updater) {
  if (Array.isArray(cache)) return updater(cache);
  const current = cache && typeof cache === "object"
    ? cache
    : { messages: [], hasOlder: false };
  return {
    ...current,
    messages: updater(Array.isArray(current.messages) ? current.messages : []),
  };
}

async function fetchRecentMessageHistory(conversationId, desiredLimit) {
  const rows = [];
  const target = desiredLimit + 1;
  const pageSize = 200;
  for (let skip = 0; rows.length < target; skip += pageSize) {
    const page = await base44.entities.Message.filter(
      { conversation_id: conversationId },
      "-created_date",
      Math.min(pageSize, target - rows.length),
      skip,
    );
    rows.push(...page);
    if (page.length < Math.min(pageSize, target - (rows.length - page.length))) break;
  }
  const hasOlder = rows.length > desiredLimit;
  const visible = hasOlder ? rows.slice(0, desiredLimit) : rows;
  return { messages: visible.reverse(), hasOlder };
}

export default function Messages() {
  const { user: currentUser, checkUserAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [messageHistoryLimit, setMessageHistoryLimit] = useState(200);
  const [sidebarTab, setSidebarTab] = useState("chats");
  const [lockedLinkConversationId, setLockedLinkConversationId] = useState(null);
  const [showLockedAccess, setShowLockedAccess] = useState(false);
  const { hasEntitlement } = useSubscription();
  const {
    isReady: lockedChatsReady,
    isUnlocked: lockedChatsUnlocked,
    lockedConversationIds,
    canAccessConversation,
  } = useLockedChats();

  // Mark a conversation as read (stores timestamp in localStorage for the unread badge).
  const markConversationRead = (convId) => {
    if (!convId) return;
    try { localStorage.setItem(`lastReadAt:${currentUser?.id}:${convId}`, Date.now().toString()); } catch {}
  };

  const handleSelectConv = (convId) => {
    if (!convId) return;
    // On mobile, update the URL too. This makes the selected DM survive
    // touch/click timing quirks and gives the existing deep-link resolver a
    // second, authoritative way to restore the chat view.
    const nextSearch = `?id=${encodeURIComponent(convId)}`;
    if (location.search !== nextSearch) {
      navigate(`${location.pathname}${nextSearch}`, { replace: true });
    }
    if (convId !== selectedConvId) setMessageHistoryLimit(200);
    setSelectedConvId(convId);
    markConversationRead(convId);
  };

  const handleBackToConversations = () => {
    if (location.search) {
      navigate(location.pathname, { replace: true });
    }
    setSelectedConvId(null);
    setMessageHistoryLimit(200);
  };

  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showExternal, setShowExternal] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [sharedComposeText, setSharedComposeText] = useState("");
  const queryClient = useQueryClient();
  const lastMessagesUserIdRef = useRef(undefined);

  useEffect(() => {
    const nextUserId = currentUser?.id || null;
    const previousUserId = lastMessagesUserIdRef.current;
    const isInitialIdentityResolution = previousUserId === undefined;
    lastMessagesUserIdRef.current = nextUserId;

    // Identity changes clear previous-account UI state. URL/query changes for
    // the same user must not reset selectedConvId; on iOS that created a
    // clear-then-restore race every time a DM updated ?id=.
    if (!isInitialIdentityResolution && previousUserId !== nextUserId) {
      if (window.location.pathname === "/messages" && window.location.search) {
        navigate("/messages", { replace: true });
      }
      setShowNewDM(false);
      setShowNewGroup(false);
      setShowExternal(false);
      setShowInvite(false);
      setSelectedConvId(null);
      setMessageHistoryLimit(200);
      setLockedLinkConversationId(null);
      setShowLockedAccess(false);
    }
  }, [currentUser?.id, navigate]);

  useEffect(() => {
    if (location.pathname === "/messages" && !location.search) {
      setSelectedConvId(null);
      setMessageHistoryLimit(200);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const composeText = typeof location.state?.composeText === "string"
      ? location.state.composeText.trim()
      : "";
    if (!composeText) return;
    setSharedComposeText(composeText);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      // Immediately refresh the active chat and conversation list when returning
      // to the tab. Presence itself is maintained app-wide in App.jsx.
      queryClient.invalidateQueries({ queryKey: ["messages", currentUser?.id, selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["conversations", currentUser?.id] });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [currentUser?.id, queryClient, selectedConvId]);

  const { data: users = [], isError: usersError } = useQuery({
    queryKey: ["users", "presence", currentUser?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('listPublicUsers', { includePresence: true });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.viewerUserId !== currentUser?.id ||
        !Array.isArray(res?.data?.users)
      ) {
        throw new Error("User directory response was not confirmed.");
      }
      const updated = res?.data?.message;
      if (
        res?.data?.success !== true ||
        updated?.id !== messageId ||
        !res?.data?.reactions ||
        typeof res.data.reactions !== "object"
      ) {
        throw new Error("Reaction update was not confirmed.");
      }
      return res.data?.users || [];
    },
    enabled: !!currentUser?.id,
    refetchInterval: 45_000,
    staleTime: 20_000,
  });

  const { data: conversations = [], isError: conversationsError } = useQuery({
    queryKey: ["conversations", currentUser?.id],
    queryFn: () => filterAll(
      base44.entities.Conversation,
      { participant_ids: currentUser.id },
      "-last_message_at",
    ),
    enabled: !!currentUser?.id,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const { data: publicRooms = [] } = useQuery({
    queryKey: ["public-conversations"],
    queryFn: () => filterAll(
      base44.entities.Conversation,
      { type: "group", is_public: true },
      "-last_message_at",
    ),
    enabled: !!currentUser?.id,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const discoveryConversations = [
    ...conversations,
    ...publicRooms.filter((room) => !conversations.some((conversation) => conversation.id === room.id)),
  ];

  const partitionedConversations = lockedChatsReady
    ? partitionUserConversations(
        conversations,
        currentUser?.id,
        lockedChatsUnlocked ? [] : lockedConversationIds,
      )
    : { visible: [], locked: [] };
  const myConversations = partitionedConversations.visible;

  useEffect(() => {
    if (!lockedChatsReady || !currentUser?.id || !location.search) return;
    const requestedId = new URLSearchParams(location.search).get("id");
    if (!requestedId) return;

    const memberConversations = conversations.filter((conversation) =>
      conversation.participant_ids?.includes(currentUser.id)
    );
    const resolution = resolveRequestedConversation(
      memberConversations,
      requestedId,
      lockedConversationIds,
      lockedChatsUnlocked,
    );

    if (resolution.status === "allowed") {
      setLockedLinkConversationId(null);
      setShowLockedAccess(false);
      handleSelectConv(requestedId);
    } else if (resolution.status === "locked") {
      setSelectedConvId(null);
      setMessageHistoryLimit(200);
      setLockedLinkConversationId(requestedId);
      setShowLockedAccess(true);
    } else if (resolution.status === "missing") {
      // The conversation may have been deleted or this user may have been
      // removed while a mobile deep link is still open. Clear every selected
      // chat surface and normalize the URL so Messages returns to its list
      // instead of rendering a stale/empty conversation.
      setSelectedConvId(null);
      setMessageHistoryLimit(200);
      setLockedLinkConversationId(null);
      setShowLockedAccess(false);
      if (location.pathname === "/messages" && location.search) {
        navigate("/messages", { replace: true });
      }
    }
  }, [
    location.search,
    conversations,
    currentUser?.id,
    lockedChatsReady,
    lockedChatsUnlocked,
    lockedConversationIds,
  ]);

  const {
    data: messageHistory = { messages: [], hasOlder: false },
    isLoading: isLoadingMessages,
    isFetching: isFetchingMessages,
    isError: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["messages", currentUser?.id, selectedConvId],
    queryFn: () => fetchRecentMessageHistory(selectedConvId, messageHistoryLimit),
    enabled: !!currentUser?.id && !!selectedConvId && lockedChatsReady && canAccessConversation(selectedConvId),
    refetchInterval: 5000,
    staleTime: 3000,
  });
  const messages = messageHistory.messages;

  useEffect(() => {
    if (messageHistoryLimit <= 200 || !selectedConvId) return;
    void refetchMessages();
  }, [messageHistoryLimit, selectedConvId, refetchMessages]);

  const latestVisibleMessageId = messages.length > 0
    ? messages[messages.length - 1]?.id
    : null;

  useEffect(() => {
    if (!selectedConvId || !currentUser?.id || document.visibilityState !== "visible") return;
    markConversationRead(selectedConvId);
  }, [selectedConvId, currentUser?.id, latestVisibleMessageId]);

  // Message and conversation lists already poll every five seconds above.
  // Avoid raw realtime entity subscriptions so the client never receives an
  // event payload outside the normal scoped read query path.

  const editMessage = useMutation({
    mutationFn: async ({ id, text }) => {
      const clientRequestKey = await messageEditRequestKey(id, text);
      const res = await base44.functions.invoke("mutateConversationMessage", {
        action: "edit",
        message_id: id,
        text,
        client_request_key: clientRequestKey,
      });
      if (res?.data?.moderation) return { _flagged: res.data.moderation };
      if (res?.data?.error) throw new Error(res.data.error);
      const updated = res?.data?.message;
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "edit" ||
        res?.data?.userId !== currentUser?.id ||
        res?.data?.messageId !== id ||
        res?.data?.clientRequestKey !== clientRequestKey ||
        updated?.id !== id ||
        updated?.sender_id !== currentUser?.id ||
        updated?.text !== text
      ) {
        throw new Error("Message edit was not confirmed.");
      }
      return updated;
    },
    onError: () => {
      toast.error("Message edit failed. Your draft was kept so you can retry.");
    },
    onSuccess: (msg) => {
      if (msg?._flagged) {
        const f = msg._flagged;
        if (f.is_banned) toast.error("Edit blocked. Your account is now banned for repeated policy violations.");
        else if (f.action_taken === "timeout") toast.error("Edit blocked. You are timed out for 48 hours.");
        else toast.error("Edit blocked for a policy violation.");
        void checkUserAuth();
      }
    },
    onSettled: async (_data, _error, variables) => {
      if (variables?.conversationId) {
        await queryClient.invalidateQueries({ queryKey: ["messages", currentUser?.id, variables.conversationId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["conversations", currentUser?.id] });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (msgData) => {
      const conversationId = msgData.conversation_id;
      if (!conversationId) throw new Error("Conversation is required");
      const res = await base44.functions.invoke("sendConversationMessage", {
        ...msgData,
        conversation_id: conversationId,
      });
      if (res?.data?.moderation) {
        return { _flagged: res.data.moderation };
      }
      if (res?.data?.error) {
        throw sendErrorFromResponse(res);
      }
      const sent = res?.data?.message;
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "send" ||
        res?.data?.userId !== currentUser?.id ||
        res?.data?.conversationId !== conversationId ||
        res?.data?.clientMessageKey !== msgData.client_message_key ||
        !sent?.id ||
        sent?.conversation_id !== conversationId ||
        sent?.sender_id !== currentUser?.id ||
        sent?.client_message_key !== msgData.client_message_key
      ) {
        const error = new Error("Message send was not confirmed.");
        error.status = 500;
        throw error;
      }
      return sent;
    },
    onMutate: (msgData) => {
      const conversationId = msgData.conversation_id || selectedConvId;
      if (!conversationId) throw new Error("Conversation is required");
      msgData.conversation_id = conversationId;
      queryClient.cancelQueries({ queryKey: ["messages", currentUser?.id, conversationId] });
      const previous = queryClient.getQueryData(["messages", currentUser?.id, conversationId]);
      const previousConversations = queryClient.getQueryData(["conversations", currentUser?.id]);
      const clientMessageKey = msgData.client_message_key || createClientMessageKey();
      msgData.client_message_key = clientMessageKey;
      const tempId = `temp-${clientMessageKey}`;
      const tempMsg = {
        id: tempId,
        _tempId: tempId,
        ...msgData,
        conversation_id: conversationId,
        sender_id: currentUser?.id,
        sender_name: currentUser?.display_name || currentUser?.full_name,
        sender_avatar: currentUser?.avatar_url,
        created_date: new Date().toISOString(),
        _optimistic: true,
        _retryable: false,
        _deliveryState: "sending",
        _sendError: null,
      };
      queryClient.setQueryData(["messages", currentUser?.id, conversationId], (old) => updateMessageHistory(old, (rows) => applyQueuedMessage(rows, tempMsg))
      );
      queryClient.setQueryData(["conversations", currentUser?.id], (old = []) => {
        const updated = old.map(c =>
          c.id === conversationId
            ? { ...c, last_message_text: msgData.text || `Sent a ${msgData.type}`, last_message_at: tempMsg.created_date }
            : c
        );
        return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
      });
      const outboundEntry = createOutboundEntry({
        clientMessageKey,
        conversationId,
        payload: msgData,
        sender: {
          id: currentUser?.id,
          name: currentUser?.display_name || currentUser?.full_name,
          avatar: currentUser?.avatar_url,
        },
      });
      return { previous, previousConversations, tempId, clientMessageKey, conversationId, outboundEntry };
    },
    onError: (err, _msgData, ctx) => {
      const status = Number(err?.status);
      const retryable = !Number.isFinite(status) || status === 429 || status >= 500;
      queryClient.setQueryData(["messages", currentUser?.id, ctx?.conversationId], (old) => updateMessageHistory(old, (rows) => applySendFailure(rows, ctx?.clientMessageKey, err?.message, retryable))
      );
      if (retryable && ctx?.outboundEntry) {
        const failedEntry = {
          ...ctx.outboundEntry,
          state: "failed",
          attemptCount: 1,
          nextAttemptAt: Date.now() + getBackoffDelay(1),
          lastError: err?.message || "Message could not be sent.",
        };
        try {
          enqueueOutbound(failedEntry);
          window.dispatchEvent(new Event("nalichat:outbound-queue"));
        } catch (queueError) {
          console.error("Unable to persist failed message for retry:", queueError);
        }
      }
      if (ctx?.previousConversations) {
        queryClient.setQueryData(["conversations", currentUser?.id], ctx.previousConversations);
      }
      if (err?.message === "timed_out") {
        toast.error("You are currently timed out and cannot send messages.");
      } else if (err?.message === "banned") {
        toast.error("You may only message an admin while your account is banned.");
      } else {
        toast.error("Message failed to send.");
      }
    },
    onSuccess: (msg, _vars, ctx) => {
      if (msg?._flagged) {
        const f = msg._flagged;
        queryClient.setQueryData(["messages", currentUser?.id, ctx?.conversationId], (old) => updateMessageHistory(old, (rows) => rows.filter(m => m._tempId !== ctx?.tempId))
        );
        if (ctx?.previousConversations) {
          queryClient.setQueryData(["conversations", currentUser?.id], ctx.previousConversations);
        }
        const labels = {
          violence: "violence", racism: "racism", sexual_violence: "sexual violence",
          bullying: "bullying", illegal_activity: "illegal activity",
        };
        if (f.is_banned) {
          toast.error("You have been banned for repeated policy violations. To appeal, message an admin.");
        } else if (f.action_taken === "timeout") {
          toast.error(`Message blocked for ${labels[f.category] || "a policy violation"}. 2nd offence — you are timed out for 48 hours.`);
        } else {
          toast.error(`Message blocked for ${labels[f.category] || "a policy violation"}. This is your 1st warning — a 2nd offence is a 48-hour timeout.`);
        }
        void checkUserAuth();
        return;
      }
      queryClient.setQueryData(["messages", currentUser?.id, ctx?.conversationId], (old) => updateMessageHistory(old, (rows) => applySendSuccess(rows, msg, ctx?.clientMessageKey, ctx?.tempId))
      );
      queryClient.invalidateQueries({ queryKey: ["conversations", currentUser?.id] });
      if (msg?.id && msg?.type !== "session") {
        recordSquadActivity("message", msg.id);
      }
    },
  });

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    let cancelled = false;
    let retryTimer = null;

    const sendQueuedEntry = async (entry) => {
      const res = await base44.functions.invoke("sendConversationMessage", {
        ...entry.payload,
        conversation_id: entry.conversationId,
        client_message_key: entry.clientMessageKey,
      });
      if (res?.data?.moderation) {
        return { rejection: { type: "moderation", details: res.data.moderation } };
      }
      if (res?.data?.error) throw sendErrorFromResponse(res);
      if (!res?.data?.message) throw new Error("The message service returned no message.");
      return { message: res.data.message };
    };

    const scheduleNext = () => {
      if (cancelled) return;
      if (retryTimer) window.clearTimeout(retryTimer);
      const nextRetryAt = getNextRetryAt(undefined, currentUser.id);
      if (nextRetryAt == null) return;
      retryTimer = window.setTimeout(
        () => { void flushQueue(); },
        Math.max(250, nextRetryAt - Date.now()),
      );
    };

    const flushQueue = async () => {
      try {
        await flushOutboundQueue({
        userId: currentUser.id,
        send: sendQueuedEntry,
        onSending: (entry) => {
          queryClient.setQueryData(["messages", currentUser?.id, entry.conversationId], (old) => updateMessageHistory(old, (rows) => applyQueuedMessage(rows, queueEntryToMessage(entry)))
          );
        },
        onSent: (entry, message) => {
          queryClient.setQueryData(["messages", currentUser?.id, entry.conversationId], (old) => updateMessageHistory(old, (rows) => applySendSuccess(rows, message, entry.clientMessageKey, `temp-${entry.clientMessageKey}`))
          );
          queryClient.invalidateQueries({ queryKey: ["conversations", currentUser?.id] });
        },
        onRejected: (entry, rejection) => {
          queryClient.setQueryData(["messages", currentUser?.id, entry.conversationId], (old) => updateMessageHistory(old, (rows) => removeClientMessage(rows, entry.clientMessageKey))
          );
          toast.error(rejection?.message || "A queued message could not be sent.");
        },
        onFailed: (entry, error) => {
          queryClient.setQueryData(["messages", currentUser?.id, entry.conversationId], (old) => updateMessageHistory(old, (rows) => applySendFailure(rows, entry.clientMessageKey, error?.message, true))
          );
        },
        });
      } catch (queueError) {
        console.error("Unable to flush outbound message queue:", queueError);
      }
      scheduleNext();
    };

    for (const entry of readOutboundQueue().filter((item) => item.sender.id === currentUser.id)) {
      queryClient.setQueryData(["messages", currentUser?.id, entry.conversationId], (old) => updateMessageHistory(old, (rows) => applyQueuedMessage(rows, queueEntryToMessage(entry)))
      );
    }

    const handleQueueSignal = () => { void flushQueue(); };
    window.addEventListener("online", handleQueueSignal);
    window.addEventListener("nalichat:outbound-queue", handleQueueSignal);
    void flushQueue();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener("online", handleQueueSignal);
      window.removeEventListener("nalichat:outbound-queue", handleQueueSignal);
    };
  }, [currentUser?.id, queryClient]);

  const isTimedOut = currentUser?.timeout_until && new Date(currentUser.timeout_until) > new Date();

  const handleReact = async (messageId, emoji) => {
    const conversationId = selectedConvId;
    const msg = messages.find(m => m.id === messageId);
    if (!conversationId || !msg || !currentUser) return;
    const previous = queryClient.getQueryData(["messages", currentUser?.id, conversationId]);
    const optimisticReactions = { ...(msg.reactions || {}) };
    const userKey = `${emoji}__${currentUser.id}`;
    if (optimisticReactions[userKey]) delete optimisticReactions[userKey];
    else optimisticReactions[userKey] = emoji;

    queryClient.setQueryData(["messages", currentUser?.id, conversationId], (old) => updateMessageHistory(old, (rows) => rows.map(m => (m.id === messageId ? { ...m, reactions: optimisticReactions } : m)))
    );
    try {
      const res = await base44.functions.invoke("mutateConversationMessage", {
        action: "react",
        message_id: messageId,
        emoji,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "react" ||
        res?.data?.userId !== currentUser.id ||
        res?.data?.messageId !== messageId ||
        res?.data?.message?.id !== messageId ||
        !res?.data?.reactions ||
        typeof res.data.reactions !== "object"
      ) {
        throw new Error("Message reaction was not confirmed.");
      }
    } catch (err) {
      if (previous) queryClient.setQueryData(["messages", currentUser?.id, conversationId], previous);
      if (err?.message === "timed_out") {
        toast.error("You are timed out and cannot react to messages right now.");
      } else if (err?.message === "banned") {
        toast.error("You cannot react to messages while your account is banned.");
      } else {
        toast.error("Couldn't update the reaction. Please try again.");
      }
    } finally {
      queryClient.invalidateQueries({ queryKey: ["messages", currentUser?.id, conversationId] });
    }
  };

  const startDM = async (otherUser) => {
    if (!otherUser?.id || !currentUser?.id) return;
    try {
      const existing = myConversations.find(c =>
        c.type === "dm" && c.participant_ids?.includes(otherUser.id) && c.participant_ids?.length === 2
      );
      if (existing) { handleSelectConv(existing.id); return; }
      const created = await base44.functions.invoke("manageConversation", {
        action: "create_dm",
        participant_ids: [otherUser.id],
      });
      if (created?.data?.error) throw new Error(created.data.error);
      const conv = created?.data?.conversation;
      if (
        created?.data?.success !== true ||
        !conv?.id ||
        conv?.type !== "dm" ||
        !Array.isArray(conv?.participant_ids) ||
        conv.participant_ids.length !== 2 ||
        !conv.participant_ids.includes(currentUser.id) ||
        !conv.participant_ids.includes(otherUser.id)
      ) throw new Error("Conversation was not created");
      await queryClient.invalidateQueries({ queryKey: ["conversations", currentUser?.id] });
      if (lockedConversationIds.includes(conv.id) && !lockedChatsUnlocked) {
        setLockedLinkConversationId(conv.id);
        setShowLockedAccess(true);
        return;
      }
      handleSelectConv(conv.id);
    } catch (err) {
      toast.error("Couldn't start the conversation. Please try again.");
      throw err;
    }
  };

  const createGroup = async ({ name, participant_ids, client_request_key }) => {
    if (!currentUser?.id || !participant_ids?.length) return;
    try {
      const created = await base44.functions.invoke("manageConversation", {
        action: "create_group",
        name,
        participant_ids,
        client_request_key,
      });
      if (created?.data?.error) throw new Error(created.data.error);
      const conv = created?.data?.conversation;
      const expectedParticipantIds = new Set([currentUser.id, ...participant_ids]);
      if (
        created?.data?.success !== true ||
        !conv?.id ||
        conv?.type !== "group" ||
        conv?.name !== name ||
        !Array.isArray(conv?.participant_ids) ||
        conv.participant_ids.length !== expectedParticipantIds.size ||
        ![...expectedParticipantIds].every((id) => conv.participant_ids.includes(id))
      ) throw new Error("Group was not created");
      await queryClient.invalidateQueries({ queryKey: ["conversations", currentUser?.id] });
      handleSelectConv(conv.id);
    } catch (err) {
      toast.error("Couldn't create the group. Please try again.");
      throw err;
    }
  };

  useEffect(() => {
    if (!selectedConvId) return;
    if (!lockedChatsReady || !canAccessConversation(selectedConvId)) {
      setSelectedConvId(null);
    }
  }, [selectedConvId, lockedChatsReady, lockedChatsUnlocked, lockedConversationIds]);

  const selectedConv = myConversations.find(c => c.id === selectedConvId);
  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  // Public user discovery intentionally redacts account roles, so the client
  // cannot reliably identify whether the other DM participant is an admin.
  // Keep group chats blocked for banned users, but allow 1:1 DMs to reach the
  // server where the authoritative admin-appeal policy is enforced.
  const isBlocked = isTimedOut
    || (currentUser?.is_banned && selectedConv?.type !== "dm");
  const activeChatTheme = getChatTheme(resolveEffectiveChatThemeId(
    currentUser?.chat_theme_id,
    hasEntitlement?.(CHAT_THEME_ENTITLEMENT) === true,
  ));

  return (
    <div className="relative h-full min-h-0 sm:h-[calc(100vh-80px)] p-0 sm:p-4 md:p-6 flex justify-center overflow-hidden">
      <div className="w-full max-w-7xl h-full max-h-full flex flex-col sm:flex-row bg-card/60 sm:bg-card/40 backdrop-blur-3xl sm:border border-border/40 sm:rounded-[2.5rem] shadow-none sm:shadow-2xl overflow-hidden relative">
        
        {/* Sidebar */}
        <div className={cn(
          "w-full sm:w-[360px] md:w-[400px] shrink-0 h-full min-h-0 flex flex-col bg-background/40 sm:border-r border-border/30 transition-all z-10 relative",
          selectedConvId ? "hidden sm:flex" : "flex"
        )}>
          {/* Header */}
          <div className="px-6 pt-8 pb-2 flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-heading font-bold tracking-tight">Messages</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20" title="New Conversation Options" aria-label="New Conversation Options">
                    <Plus className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl p-2">
                  <DropdownMenuItem onClick={() => setShowNewDM(true)} className="gap-3 cursor-pointer py-3 px-3 rounded-xl focus:bg-primary/10 focus:text-primary">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">New Message</span>
                      <span className="text-[10px] text-muted-foreground">Start a direct chat</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowNewGroup(true)} className="gap-3 cursor-pointer py-3 px-3 rounded-xl focus:bg-accent/10 focus:text-accent">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">New Group</span>
                      <span className="text-[10px] text-muted-foreground">Create a room</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowInvite(true)} className="gap-3 cursor-pointer py-3 px-3 rounded-xl focus:bg-chart-3/10 focus:text-chart-3">
                    <div className="w-8 h-8 rounded-full bg-chart-3/20 flex items-center justify-center">
                      <UserPlus className="w-4 h-4 text-chart-3" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">Send Invite</span>
                      <span className="text-[10px] text-muted-foreground">Invite external users</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-6 border-b border-border/40 pb-0">
              <button 
                onClick={() => setSidebarTab("chats")}
                className={cn("pb-3 text-sm font-semibold transition-colors relative", sidebarTab === "chats" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Chats
                {sidebarTab === "chats" && <motion.div layoutId="activeTabMsg" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              <button 
                onClick={() => setSidebarTab("contacts")}
                className={cn("pb-3 text-sm font-semibold transition-colors relative", sidebarTab === "contacts" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Network
                {sidebarTab === "contacts" && <motion.div layoutId="activeTabMsg" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden relative bg-background/40">
            {usersError && (
              <div className="mx-4 mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
                Couldn't load people. Names and new-chat discovery may be unavailable until you refresh.
              </div>
            )}
            <AnimatePresence mode="wait">
              {sidebarTab === "chats" ? (
                <motion.div key="chats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col bg-background/40">
                  <PullToRefresh onRefresh={async () => {
                    await Promise.all([
                      queryClient.invalidateQueries({ queryKey: ["conversations", currentUser?.id] }),
                      queryClient.invalidateQueries({ queryKey: ["public-conversations"] }),
                    ]);
                  }} className="flex-1 overflow-y-auto">
                    {conversationsError ? (
                      <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                        Couldn't load conversations. Pull to refresh or try again.
                      </div>
                    ) : (
                    <ConversationList
                      conversations={discoveryConversations}
                      myConversations={myConversations}
                      selectedId={selectedConvId}
                      onSelect={handleSelectConv}
                      users={users}
                      currentUserId={currentUser?.id}
                      onStartDM={startDM}
                    />
                    )}
                  </PullToRefresh>
                </motion.div>
              ) : (
                <motion.div key="contacts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col pt-2 bg-background/40">
                  <ContactsTab 
                    currentUserId={currentUser?.id} 
                    onMessageContact={async (u) => {
                      try {
                        await startDM(u);
                        setSidebarTab("chats");
                      } catch (error) {
                        console.error("Failed to start DM from Contacts:", error);
                        toast.error("Couldn't start this conversation. Please try again.");
                      }
                    }} 
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Chat View */}
        <div className={cn(
        "flex-1 flex flex-col min-w-0 bg-transparent relative z-0 overflow-hidden",
        !selectedConvId && "hidden sm:flex"
        )}>
          {selectedConv ? (
            <ChatView
              conversation={selectedConv}
              messages={messages}
              isLoading={isLoadingMessages}
              loadError={messagesError}
              hasOlderMessages={messageHistory.hasOlder}
              isLoadingOlderMessages={isFetchingMessages && !isLoadingMessages}
              onLoadOlderMessages={() => setMessageHistoryLimit((limit) => limit + 200)}
              currentUser={currentUser}
              users={users}
              isBlocked={isBlocked}
              moderationBanner={isBlocked ? <ModerationBanner currentUser={currentUser} /> : null}
              theme={activeChatTheme}
              initialComposeText={sharedComposeText}
              onInitialComposeConsumed={() => setSharedComposeText("")}
              onSendMessage={(data) => {
                if (isBlocked) {
                  toast.error(currentUser?.is_banned ? "You are banned from sending messages." : "You are timed out and cannot send messages right now.");
                  throw new Error(currentUser?.is_banned ? "banned" : "timed_out");
                }
                sendMessage.mutate({ ...data, conversation_id: selectedConvId });
              }}
              onEditMessage={async (id, text) => {
                const result = await editMessage.mutateAsync({ id, text, conversationId: selectedConvId });
                if (result?._flagged) throw new Error("moderated");
                return result;
              }}
              onReact={handleReact}
              onRetryMessage={(message) => {
                if (!message?.client_message_key) return;
                try {
                  const queued = markOutboundForRetry(message.client_message_key);
                  if (queued) {
                    window.dispatchEvent(new Event("nalichat:outbound-queue"));
                    return;
                  }
                } catch (queueError) {
                  console.error("Unable to persist manual message retry:", queueError);
                }
                sendMessage.mutate({
                  text: message.text || "",
                  type: message.type || "text",
                  file_url: message.file_url,
                  file_name: message.file_name,
                  file_size: message.file_size,
                  file_type: message.file_type,
                  duration: message.duration,
                  reply_to_id: message.reply_to_id,
                  reply_to_text: message.reply_to_text,
                  reply_to_sender: message.reply_to_sender,
                  client_message_key: message.client_message_key,
                  conversation_id: message.conversation_id || selectedConvId,
                });
              }}
              onBack={handleBackToConversations}
              onStartDM={startDM}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-8 shadow-[0_0_60px_-15px_rgba(var(--primary),0.3)] border border-white/5 backdrop-blur-xl">
                  <div className="w-24 h-24 rounded-full bg-card flex items-center justify-center shadow-inner">
                    <MessageSquare className="w-10 h-10 text-primary/60" />
                  </div>
                </div>
                <h2 className="text-2xl font-heading font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">Your Messages</h2>
                <p className="text-base text-muted-foreground max-w-[300px] leading-relaxed">
                  Select a conversation from the sidebar or start a new one to connect with your network.
                </p>
                <div className="mt-8 flex gap-3">
                  <Button onClick={() => setShowNewDM(true)} className="rounded-xl shadow-lg shadow-primary/20">
                    <MessageSquare className="w-4 h-4 mr-2" /> New Chat
                  </Button>
                  <Button onClick={() => setShowNewGroup(true)} variant="secondary" className="rounded-xl border border-border/50">
                    <Users className="w-4 h-4 mr-2" /> New Group
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      <NewChatDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        users={otherUsers}
        onSelectUser={startDM}
        currentUserId={currentUser?.id}
      />
      <GroupChatDialog
        open={showNewGroup}
        onOpenChange={setShowNewGroup}
        users={otherUsers.filter((candidate) => candidate.can_group_chat === true)}
        onCreate={createGroup}
      />
      <ExternalMessageDialog
        open={showExternal}
        onOpenChange={setShowExternal}
      />
      <LockedChatAccessDialog
        open={showLockedAccess}
        onOpenChange={setShowLockedAccess}
        initialMode="unlock"
        onUnlocked={() => {
          if (lockedLinkConversationId) handleSelectConv(lockedLinkConversationId);
          setLockedLinkConversationId(null);
        }}
        onCancel={() => setLockedLinkConversationId(null)}
      />
      <GlobalInviteDialog 
        open={showInvite}
        onOpenChange={setShowInvite}
      />
    </div>
  );
}