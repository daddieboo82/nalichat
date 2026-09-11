// @vitest-environment jsdom
import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LockedChatsProvider, LOCKED_CHAT_IDLE_TIMEOUT_MS, useLockedChats } from "@/lib/LockedChatsContext";

const authState = vi.hoisted(() => ({
  value: { isAuthenticated: true, user: { id: "user-1" } },
}));
const subscriptionState = vi.hoisted(() => ({ entitled: true }));
const vaultApi = vi.hoisted(() => ({
  getLockedChatState: vi.fn(),
  verifyLockedChatPin: vi.fn(),
  configureLockedChatPin: vi.fn(),
  setLockedConversation: vi.fn(),
  requestLockedChatPinReset: vi.fn(),
  completeLockedChatPinReset: vi.fn(),
}));

function deferred() {
  let resolve;
  const promise = new Promise((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

vi.mock("@/lib/AuthContext", () => ({ useAuth: () => authState.value }));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ hasEntitlement: () => subscriptionState.entitled }),
}));
vi.mock("@/lib/lockedChatClient", () => vaultApi);

const wrapper = ({ children }) => <LockedChatsProvider>{children}</LockedChatsProvider>;

describe("locked chat unlock lifecycle", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    authState.value = { isAuthenticated: true, user: { id: "user-1" } };
    subscriptionState.entitled = true;
    vaultApi.getLockedChatState.mockResolvedValue({
      lockedConversationIds: ["conversation-1"],
      security: { configured: true, salt: "salt", iterations: 600_000 },
    });

    afterEach(() => {
      cleanup();
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    });
    vaultApi.verifyLockedChatPin.mockResolvedValue({ unlocked: true });
  });

  it("starts fail-locked and permits access only after successful verification", async () => {
    const { result } = renderHook(() => useLockedChats(), { wrapper });

    expect(result.current.canAccessConversation("conversation-1")).toBe(false);
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.canAccessConversation("conversation-1")).toBe(false);

    await act(async () => result.current.unlock("123456"));
    expect(result.current.canAccessConversation("conversation-1")).toBe(true);
  });

  it("relocks immediately when the app becomes hidden", async () => {
    const { result } = renderHook(() => useLockedChats(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => result.current.unlock("123456"));

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(result.current.isUnlocked).toBe(false);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("relocks on the cross-tab lock signal", async () => {
    const { result } = renderHook(() => useLockedChats(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => result.current.unlock("123456"));

    act(() => window.dispatchEvent(new Event("nali-lock-vault")));
    expect(result.current.isUnlocked).toBe(false);
  });

  it("does not let an in-flight verification override a later lock", async () => {
    const verification = deferred();
    vaultApi.verifyLockedChatPin.mockReturnValue(verification.promise);
    const { result } = renderHook(() => useLockedChats(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let unlockPromise;
    act(() => {
      unlockPromise = result.current.unlock("123456");
    });
    act(() => window.dispatchEvent(new Event("nali-lock-vault")));
    verification.resolve({ unlocked: true });

    await expect(unlockPromise).rejects.toThrow("relocked");
    expect(result.current.isUnlocked).toBe(false);
  });

  it("locks and refreshes metadata after another tab changes vault state", async () => {
    const { result } = renderHook(() => useLockedChats(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => result.current.unlock("123456"));
    vaultApi.getLockedChatState.mockResolvedValue({
      lockedConversationIds: ["conversation-1", "conversation-2"],
      security: { configured: true, salt: "new-salt", iterations: 600_000 },
    });

    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: "nali:locked-chat-lock-signal",
      newValue: "state:123",
    })));

    await waitFor(() => expect(result.current.lockedConversationIds).toContain("conversation-2"));
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.security.salt).toBe("new-salt");
  });

  it("ignores an older privacy refresh that finishes after a newer one", async () => {
    const first = deferred();
    const second = deferred();
    let calls = 0;
    vaultApi.getLockedChatState.mockImplementation(() => {
      calls += 1;
      return calls === 1 ? first.promise : second.promise;
    });
    const { result } = renderHook(() => useLockedChats(), { wrapper });

    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: "nali:locked-chat-lock-signal",
      newValue: "state:456",
    })));
    second.resolve({
      lockedConversationIds: ["new-lock"],
      security: { configured: true, salt: "new", iterations: 600_000 },
    });
    await waitFor(() => expect(result.current.lockedConversationIds).toEqual(["new-lock"]));

    first.resolve({
      lockedConversationIds: [],
      security: { configured: false },
    });
    await act(async () => Promise.resolve());
    expect(result.current.lockedConversationIds).toEqual(["new-lock"]);
  });

  it("relocks after the inactivity timeout", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLockedChats(), { wrapper });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => result.current.unlock("123456"));

    act(() => vi.advanceTimersByTime(LOCKED_CHAT_IDLE_TIMEOUT_MS));
    expect(result.current.isUnlocked).toBe(false);
    vi.useRealTimers();
  });

  it("fails closed when server privacy state cannot be loaded", async () => {
    vaultApi.getLockedChatState.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useLockedChats(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.canAccessConversation("ordinary-chat")).toBe(false);
  });

  it("allows PIN access to retained locked chats after a downgrade", async () => {
    subscriptionState.entitled = false;
    const { result } = renderHook(() => useLockedChats(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.isEntitled).toBe(false);
    expect(result.current.canAccessConversation("conversation-1")).toBe(false);
    await act(async () => result.current.unlock("123456"));
    expect(result.current.canAccessConversation("conversation-1")).toBe(true);
  });
});
