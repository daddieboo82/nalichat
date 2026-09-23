// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FollowUpReminderDialog from "./FollowUpReminderDialog";
import { toLocalDateTimeInput } from "@/lib/followUpReminders";

const subscriptionState = vi.hoisted(() => ({
  value: {
    isLoading: false,
    hasEntitlement: () => false,
  },
}));

const reminderApi = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  reschedule: vi.fn(),
  cancel: vi.fn(),
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => subscriptionState.value,
}));

vi.mock("@/lib/followUpReminders", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    createFollowUpReminder: reminderApi.create,
    listFollowUpReminders: reminderApi.list,
    rescheduleFollowUpReminder: reminderApi.reschedule,
    cancelFollowUpReminder: reminderApi.cancel,
  };
});

vi.mock("sonner", () => ({ toast }));

const renderDialog = (sourceMessage = { id: "message-1" }) => render(
  <MemoryRouter>
    <FollowUpReminderDialog
      open
      onOpenChange={vi.fn()}
      conversation={{ id: "conversation-1" }}
      sourceMessage={sourceMessage}
    />
  </MemoryRouter>,
);

describe("FollowUpReminderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionState.value = {
      isLoading: false,
      hasEntitlement: () => false,
    };
    reminderApi.list.mockResolvedValue([]);
    reminderApi.create.mockResolvedValue({ reminder: { id: "reminder-1" } });
  });

  it("shows a Premium Plus prompt without blocking Free chat", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Premium Plus feature" })).toBeTruthy();
    expect(screen.getByText(/Core chat and notifications stay free/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Unlock follow-up reminders" })).toBeTruthy();
    expect(reminderApi.list).not.toHaveBeenCalled();
  });

  it("schedules an owned message in UTC and confirms success", async () => {
    subscriptionState.value = {
      isLoading: false,
      hasEntitlement: (entitlement) => entitlement === "reminders.follow_up",
    };
    renderDialog();
    await waitFor(() => expect(reminderApi.list).toHaveBeenCalledWith("user-1"));

    const future = new Date(Date.now() + 60 * 60 * 1000);
    future.setSeconds(0, 0);
    fireEvent.change(screen.getByLabelText("Remind me at"), {
      target: { value: toLocalDateTimeInput(future) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Schedule reminder" }));

    await waitFor(() => expect(reminderApi.create).toHaveBeenCalledWith({
      sourceMessageId: "message-1",
      remindAt: future.toISOString(),
      requestKey: expect.stringMatching(/^follow-up:/),
      userId: "user-1",
    }));
    expect(toast.success).toHaveBeenCalledWith("Follow-up reminder scheduled.");
  });
});
