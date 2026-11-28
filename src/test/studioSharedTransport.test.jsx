// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MobileTakeReview from "@/components/studio/MobileTakeReview";

afterEach(cleanup);

it("uses the shared timeline transport for take review and reflects its playing state", () => {
  const track = { id: 1, startTime: 12, audioUrl: "blob:take" };
  const onTogglePlayback = vi.fn();
  const { rerender } = render(<MobileTakeReview track={track} onTogglePlayback={onTogglePlayback} />);

  fireEvent.click(screen.getByRole("button", { name: "Play from this take" }));
  expect(onTogglePlayback).toHaveBeenCalledWith(track);

  rerender(<MobileTakeReview track={track} onTogglePlayback={onTogglePlayback} playing />);
  fireEvent.click(screen.getByRole("button", { name: "Pause timeline" }));
  expect(onTogglePlayback).toHaveBeenCalledTimes(2);

  rerender(<MobileTakeReview track={track} onTogglePlayback={onTogglePlayback} recording />);
  expect(screen.getByRole("button", { name: "Play from this take" }).disabled).toBe(true);
});
