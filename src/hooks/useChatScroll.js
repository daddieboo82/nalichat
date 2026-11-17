import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 200;

/**
 * Owns the chat transcript's scroll behaviour.
 *
 * The transcript is a single flex child with its own overflow, so every case that
 * can leave the newest bubble out of reach has to be handled here:
 *  - switching conversations (a stale position from the previous chat),
 *  - content that grows after paint (lazy images, waveforms, audio players),
 *  - loading older history (must not jump the reader),
 *  - the mobile keyboard covering the tail of the list.
 */
export default function useChatScroll({
  messages,
  conversationId,
  isLoadingOlderMessages,
  onLoadOlderMessages,
  keyboardOffset = 0,
}) {
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevLenRef = useRef(0);
  const prevLatestIdRef = useRef(null);
  const historyAnchorRef = useRef(null);
  const prevConversationRef = useRef(conversationId);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadSinceScroll, setUnreadSinceScroll] = useState(0);

  const pinToBottom = useCallback((behavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);
    if (nearBottom) setUnreadSinceScroll(0);
  }, []);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    isNearBottomRef.current = true;
    setShowScrollBottom(false);
    setUnreadSinceScroll(0);
    pinToBottom(behavior);
  }, [pinToBottom]);

  const loadOlderMessages = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isLoadingOlderMessages) return;
    // Remember where the reader was so the newly prepended page doesn't yank them.
    historyAnchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
    onLoadOlderMessages?.();
  }, [isLoadingOlderMessages, onLoadOlderMessages]);

  // A new conversation always opens on its newest message. ChatView stays mounted
  // between conversations, so without this reset the previous thread's position
  // and near-bottom flag leak in and the chat opens part-way up the history.
  useEffect(() => {
    if (prevConversationRef.current === conversationId) return undefined;
    prevConversationRef.current = conversationId;
    isNearBottomRef.current = true;
    prevLenRef.current = 0;
    prevLatestIdRef.current = null;
    historyAnchorRef.current = null;
    setShowScrollBottom(false);
    setUnreadSinceScroll(0);
    const frame = requestAnimationFrame(() => pinToBottom("auto"));
    return () => cancelAnimationFrame(frame);
  }, [conversationId, pinToBottom]);

  // Follow new messages only when the reader is at the tail (Messenger pattern);
  // otherwise leave them where they are and badge the jump button.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const latestId = messages[messages.length - 1]?.id || null;
    if (isNearBottomRef.current) {
      pinToBottom("auto");
      setUnreadSinceScroll(0);
    } else if (
      messages.length > prevLenRef.current
      && prevLatestIdRef.current
      && latestId !== prevLatestIdRef.current
    ) {
      setUnreadSinceScroll((count) => count + (messages.length - prevLenRef.current));
    }
    prevLenRef.current = messages.length;
    prevLatestIdRef.current = latestId;

    if (historyAnchorRef.current) {
      const { height, top } = historyAnchorRef.current;
      el.scrollTop = top + Math.max(0, el.scrollHeight - height);
      historyAnchorRef.current = null;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      isNearBottomRef.current = nearBottom;
      setShowScrollBottom(!nearBottom);
    }
  }, [messages, pinToBottom]);

  // Bubbles settle after paint — lazy images, waveforms and audio players all add
  // height later. Watching the content box keeps the tail in view instead of
  // letting the newest bubble slide below the fold.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current) pinToBottom("auto");
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [conversationId, pinToBottom]);

  // The mobile keyboard lifts the composer over the list; keep the newest bubble clear.
  useEffect(() => {
    if (keyboardOffset > 0 && isNearBottomRef.current) pinToBottom("auto");
  }, [keyboardOffset, pinToBottom]);

  return {
    scrollRef,
    contentRef,
    showScrollBottom,
    unreadSinceScroll,
    handleScroll,
    scrollToBottom,
    loadOlderMessages,
  };
}