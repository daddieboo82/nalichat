// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AiModeSelector from "./AiModeSelector";

const mockCapabilities = vi.hoisted(() => ({
  current: {
    capabilities: {
      modes: {
        standard: { available: true, entitled: true },
        deep: { available: false, entitled: false },
      },
    },
    isLoading: false,
    isError: false,
  },
}));

vi.mock("@/hooks/useAiCapabilities", () => ({
  useAiCapabilities: () => mockCapabilities.current,
}));

function renderSelector(props = {}) {
  return render(
    <MemoryRouter>
      <AiModeSelector mode="standard" onModeChange={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("AiModeSelector", () => {
  it("labels deep mode unavailable when no provider model is configured", () => {
    renderSelector();
    expect(screen.getByText("Deep unavailable")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /upgrade/i })).toBeNull();
  });

  it("shows a Premium Plus upgrade state when deep mode is operational but locked", () => {
    mockCapabilities.current = {
      capabilities: {
        modes: {
          standard: { available: true, entitled: true },
          deep: { available: true, entitled: false },
        },
      },
      isLoading: false,
      isError: false,
    };
    renderSelector();
    const upgrade = screen.getByRole("link", { name: "Upgrade to Premium Plus for Deep analysis" });
    expect(upgrade.getAttribute("href")).toBe("/pricing");
    expect(screen.getByText(/not private reasoning traces/i)).toBeTruthy();
  });

  it("allows an entitled Premium Plus user to select deep mode", () => {
    mockCapabilities.current = {
      capabilities: {
        modes: {
          standard: { available: true, entitled: true },
          deep: { available: true, entitled: true },
        },
      },
      isLoading: false,
      isError: false,
    };
    const onModeChange = vi.fn();
    renderSelector({ onModeChange });
    fireEvent.click(screen.getByRole("button", { name: "Deep" }));
    expect(onModeChange).toHaveBeenCalledWith("deep");
  });
});
