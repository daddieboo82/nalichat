// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VoiceTranscription from "@/components/messages/VoiceTranscription";
import MessageBubble from "@/components/messages/MessageBubble";
import {
  clearTranscriptionCache,
  normalizeTranscriptionState,
} from "@/lib/voiceTranscription";

const mockInvoke = vi.hoisted(() => vi.fn());
const subscription = vi.hoisted(() => ({
  current: {
    plan: "premium_plus",
    hasEntitlement: (key) => key === "voice.transcription",
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/api/base44Client", () => ({
  base44: { functions: { invoke: mockInvoke } },
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => subscription.current,
}));
vi.mock("@/components/audio/CustomMediaPlayer", () => ({
  default: ({ src }) => <audio data-testid="voice-playback" src={src} controls />,
}));
vi.mock("@/components/messages/MediaViewer", () => ({ default: () => null }));
vi.mock("@/components/messages/ViralMomentDialog", () => ({ default: () => null }));
vi.mock("@/components/messages/VoiceCardDialog", () => ({ default: () => null }));
vi.mock("@/components/messages/MessageContextMenu", () => ({ default: () => null }));
vi.mock("@/components/messages/SwipeToReply", () => ({ default: ({ children }) => <>{children}</> }));
vi.mock("@/components/ReportContentDialog", () => ({ default: () => null }));
vi.mock("framer-motion", () => ({
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
}));

const message = {
  id: "voice-message-1",
  conversation_id: "conversation-1",
  sender_id: "user-1",
  sender_name: "Ari",
  type: "audio",
  file_url: "https://media.base44.com/audio/voice.webm",
  file_name: "Voice Message",
  file_type: "audio/webm",
  file_size: 1024,
  duration: 12,
  read_by: [],
};

function renderVoice(ui = <VoiceTranscription message={message} isOwn={false} />) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("voice transcription UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTranscriptionCache(message.id);
    subscription.current = {
      plan: "premium_plus",
      hasEntitlement: (key) => key === "voice.transcription",
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
  });

  afterEach(cleanup);

  it("normalizes pending, completed, failed, and malformed server states", () => {
    expect(normalizeTranscriptionState({ transcription: { status: "pending" } }))
      .toMatchObject({ status: "pending", text: "" });
    expect(normalizeTranscriptionState({
      transcription: { status: "completed", text: "  hello  ", duplicate: true },
    })).toEqual({ status: "completed", text: "hello", errorCode: null, duplicate: true });
    expect(normalizeTranscriptionState({
      transcription: { status: "failed", error_code: "PROVIDER_TIMEOUT" },
    })).toMatchObject({ status: "failed", errorCode: "PROVIDER_TIMEOUT" });
    expect(normalizeTranscriptionState({ status: "unexpected" }))
      .toMatchObject({ status: "failed", errorCode: "INVALID_TRANSCRIPTION_RESPONSE" });
  });

  it("does not request audio processing before explicit consent", async () => {
    renderVoice();
    expect(screen.getByText(/sends this audio to our AI provider/i)).toBeTruthy();
    expect(mockInvoke).not.toHaveBeenCalled();

    mockInvoke.mockResolvedValue({
      data: {
        transcription: {
          status: "completed",
          text: "A requested transcript",
        },
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /transcribe voice note/i }));
    expect(await screen.findByText("A requested transcript")).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledWith("transcribeAudio", expect.objectContaining({
      message_id: "voice-message-1",
      request_key: "voice-transcription:voice-message-1",
    }));
    expect(mockInvoke.mock.calls[0][1]).not.toHaveProperty("audio_url");
  });

  it.each([
    ["free", /voice playback is free/i],
    ["premium", /included with Premium Plus/i],
  ])("shows the %s upgrade state without invoking AI", (plan, copy) => {
    subscription.current = {
      ...subscription.current,
      plan,
      hasEntitlement: () => false,
    };
    renderVoice();
    expect(screen.getByText(copy)).toBeTruthy();
    expect(screen.getByRole("link", { name: /view premium plus/i })).toBeTruthy();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("shows quota exhaustion without retrying automatically", async () => {
    const error = new Error("quota");
    error.response = {
      data: {
        code: "AI_DAILY_QUOTA_EXHAUSTED",
        quota: { limit: 1000, used: 1000, remaining: 0 },
      },
    };
    mockInvoke.mockRejectedValue(error);
    renderVoice();
    fireEvent.click(screen.getByRole("button", { name: /transcribe voice note/i }));
    expect(await screen.findByText(/used today's AI requests/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /view plans/i })).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("uses a fresh request key for an explicit provider retry", async () => {
    const timeout = new Error("timeout");
    timeout.response = { data: { code: "PROVIDER_TIMEOUT" } };
    mockInvoke
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce({
        data: { transcription: { status: "completed", text: "Retry succeeded" } },
      });
    renderVoice();
    fireEvent.click(screen.getByRole("button", { name: /transcribe voice note/i }));
    fireEvent.click(await screen.findByRole("button", { name: /try a new attempt/i }));
    expect(await screen.findByText("Retry succeeded")).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke.mock.calls[1][1].request_key).not.toBe(mockInvoke.mock.calls[0][1].request_key);
  });

  it("keeps basic voice-note playback available on Free", async () => {
    subscription.current = {
      ...subscription.current,
      plan: "free",
      hasEntitlement: () => false,
    };
    renderVoice(
      <MessageBubble
        message={message}
        isOwn={false}
        showAvatar={false}
        users={[]}
        currentUser={{ id: "user-2" }}
      />,
    );
    expect(screen.getByTestId("voice-playback")).toBeTruthy();
    expect(screen.getByText(/voice playback is free/i)).toBeTruthy();
    await waitFor(() => expect(mockInvoke).not.toHaveBeenCalled());
  });
});
