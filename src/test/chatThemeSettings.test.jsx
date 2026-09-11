// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ChatThemeSettings from "@/components/settings/ChatThemeSettings";

const mockBase44 = vi.hoisted(() => ({
  functions: {
    invoke: vi.fn(),
  },
}));

const mockSubscription = vi.hoisted(() => ({
  current: {
    hasEntitlement: vi.fn(() => false),
    isLoading: false,
    isError: false,
  },
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/api/base44Client", () => ({ base44: mockBase44 }));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockSubscription.current,
}));
vi.mock("@/lib/paywallAnalytics", () => ({
  trackPaywallEvent: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: mockToast }));

function renderSettings(user = { id: "user-1", chat_theme_id: "default" }, onPreferenceSaved = vi.fn()) {
  render(
    <MemoryRouter>
      <ChatThemeSettings user={user} onPreferenceSaved={onPreferenceSaved} />
    </MemoryRouter>,
  );
  return onPreferenceSaved;
}

describe("chat theme settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscription.current = {
      hasEntitlement: vi.fn(() => false),
      isLoading: false,
      isError: false,
    };
    mockBase44.functions.invoke.mockImplementation(async (_name, payload) => ({
      data: { theme_id: payload.theme_id },
    }));
  });

  afterEach(cleanup);

  it("shows a preserved premium selection as locked after downgrade", () => {
    renderSettings({ id: "user-1", chat_theme_id: "midnight" });

    const midnight = screen.getByRole("radio", { name: /Midnight Session/ });
    expect(midnight.getAttribute("aria-checked")).toBe("true");
    expect(midnight.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(/saved Premium theme is preserved/)).toBeTruthy();
    expect(screen.getByText("Unlock Premium chat themes")).toBeTruthy();

    fireEvent.click(midnight);
    expect(mockBase44.functions.invoke).not.toHaveBeenCalled();
  });

  it("persists an entitled premium selection through the server function", async () => {
    mockSubscription.current = {
      hasEntitlement: vi.fn(() => true),
      isLoading: false,
      isError: false,
    };
    const onPreferenceSaved = renderSettings();

    fireEvent.click(screen.getByRole("radio", { name: /Aurora/ }));

    await waitFor(() => {
      expect(mockBase44.functions.invoke).toHaveBeenCalledWith("setChatTheme", {
        theme_id: "aurora",
      });
      expect(onPreferenceSaved).toHaveBeenCalledWith("aurora");
      expect(screen.getByRole("radio", { name: /Aurora/ }).getAttribute("aria-checked")).toBe("true");
    });
  });

  it("keeps the prior selection and surfaces persistence failures", async () => {
    mockSubscription.current = {
      hasEntitlement: vi.fn(() => true),
      isLoading: false,
      isError: false,
    };
    mockBase44.functions.invoke.mockRejectedValueOnce(new Error("Save failed"));
    renderSettings();

    fireEvent.click(screen.getByRole("radio", { name: /Midnight Session/ }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Save failed");
    });
    expect(screen.getByRole("radio", { name: /Nali/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Midnight Session/ }).getAttribute("aria-checked")).toBe("false");
  });

  it("uses arrow keys to move and persist the radio-group selection", async () => {
    mockSubscription.current = {
      hasEntitlement: vi.fn(() => true),
      isLoading: false,
      isError: false,
    };
    renderSettings();
    const nali = screen.getByRole("radio", { name: /Nali/ });
    const midnight = screen.getByRole("radio", { name: /Midnight Session/ });

    nali.focus();
    fireEvent.keyDown(nali, { key: "ArrowRight" });

    expect(document.activeElement).toBe(midnight);
    await waitFor(() => {
      expect(mockBase44.functions.invoke).toHaveBeenCalledWith("setChatTheme", {
        theme_id: "midnight",
      });
      expect(midnight.getAttribute("aria-checked")).toBe("true");
      expect(midnight.tabIndex).toBe(0);
      expect(nali.tabIndex).toBe(-1);
    });
  });
});
