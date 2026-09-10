import { describe, expect, it } from "vitest";
import {
  MESSAGE_ENTRANCE_FLAG,
  createMessageAnimationState,
  resolveMessageAnimations,
} from "@/lib/messageAnimations";

const historical = (id) => ({ id, text: id });
const incoming = (id) => ({ id, text: id, [MESSAGE_ENTRANCE_FLAG]: true });
const queued = (key) => ({
  id: `temp-${key}`,
  client_message_key: key,
  _optimistic: true,
  [MESSAGE_ENTRANCE_FLAG]: false,
});

function observe(state, options) {
  return resolveMessageAnimations(state, {
    conversationId: "conversation-a",
    messages: [],
    ...options,
  });
}

describe("message entrance animation decisions", () => {
  it("does not animate initial history or queue-restored messages", () => {
    const loading = observe(createMessageAnimationState(), {
      isLoading: true,
    });
    const hydrated = observe(loading.state, {
      messages: [historical("old-1"), queued("queued-1")],
    });

    expect([...hydrated.animated]).toEqual([]);
  });

  it("animates a genuinely new message once", () => {
    const hydrated = observe(createMessageAnimationState(), {
      messages: [historical("old-1")],
    });
    const inserted = observe(hydrated.state, {
      messages: [historical("old-1"), incoming("new-1")],
    });
    const duplicate = observe(inserted.state, {
      messages: [historical("old-1"), incoming("new-1")],
    });

    expect([...inserted.animated]).toEqual(["new-1"]);
    expect([...duplicate.animated]).toEqual([]);
  });

  it("uses the client key across optimistic reconciliation", () => {
    const hydrated = observe(createMessageAnimationState(), { messages: [] });
    const optimistic = observe(hydrated.state, {
      messages: [{
        id: "temp-client-1",
        client_message_key: "client-1",
        [MESSAGE_ENTRANCE_FLAG]: true,
      }],
    });
    const reconciled = observe(optimistic.state, {
      messages: [{
        id: "server-1",
        client_message_key: "client-1",
        [MESSAGE_ENTRANCE_FLAG]: true,
      }],
    });

    expect([...optimistic.animated]).toEqual(["client-1"]);
    expect([...reconciled.animated]).toEqual([]);
  });

  it("does not animate cached history after a conversation switch", () => {
    const first = observe(createMessageAnimationState(), {
      messages: [historical("old-a")],
    });
    const switched = resolveMessageAnimations(first.state, {
      conversationId: "conversation-b",
      messages: [incoming("old-b"), incoming("old-c")],
      isLoading: false,
      reduceMotion: false,
    });

    expect([...switched.animated]).toEqual([]);
  });

  it("does not animate refetch additions without an explicit realtime marker", () => {
    const hydrated = observe(createMessageAnimationState(), {
      messages: [historical("old-1")],
    });
    const refetched = observe(hydrated.state, {
      messages: [historical("old-1"), historical("missed-while-away")],
    });

    expect([...refetched.animated]).toEqual([]);
  });

  it("suppresses new-message motion when reduced motion is active", () => {
    const hydrated = observe(createMessageAnimationState(), { messages: [] });
    const inserted = observe(hydrated.state, {
      messages: [incoming("new-1")],
      reduceMotion: true,
    });

    expect([...inserted.animated]).toEqual([]);
  });
});
