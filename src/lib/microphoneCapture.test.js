import { describe, expect, it, vi } from "vitest";
import { preferredMicrophoneId, microphoneConstraints, openPreferredMicrophone } from "./microphoneCapture";

describe("microphone device support across mobile and desktop", () => {
  it("uses default when no saved preference or storage blocked", () => {
    expect(preferredMicrophoneId({ getItem: () => "default" })).toBeNull();
    expect(preferredMicrophoneId({ getItem: () => { throw new Error("blocked"); } })).toBeNull();
    expect(preferredMicrophoneId({ getItem: () => "usb-id" })).toBe("usb-id");
  });

  it("uses an exact saved microphone without dropping call audio processing", async () => {
    const stream = { getTracks: () => [] };
    const media = { getUserMedia: vi.fn().mockResolvedValue(stream) };
    const audio = { echoCancellation: true, noiseSuppression: true };
    expect(await openPreferredMicrophone(media, { audio, video: false, deviceId: "usb" })).toBe(stream);
    expect(media.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, deviceId: { exact: "usb" } },
      video: false,
    });
    expect(microphoneConstraints(true, "headset")).toEqual({ audio: { deviceId: { exact: "headset" } } });
  });

  it("falls back to system default when a selected mic is disconnected", async () => {
    const unavailable = Object.assign(new Error("gone"), { name: "NotFoundError" });
    const stream = { getTracks: () => [] };
    const media = { getUserMedia: vi.fn().mockRejectedValueOnce(unavailable).mockResolvedValue(stream) };
    const fallback = vi.fn();
    expect(await openPreferredMicrophone(media, { deviceId: "bt", onFallback: fallback })).toBe(stream);
    expect(media.getUserMedia).toHaveBeenNthCalledWith(2, { audio: true, video: false });
    expect(fallback).toHaveBeenCalledOnce();
  });

  it.each(["NotAllowedError", "NotReadableError", "SecurityError"])("does not bypass %s", async name => {
    const error = Object.assign(new Error("blocked"), { name });
    const media = { getUserMedia: vi.fn().mockRejectedValue(error) };
    await expect(openPreferredMicrophone(media, { deviceId: "usb" })).rejects.toBe(error);
    expect(media.getUserMedia).toHaveBeenCalledOnce();
  });
});
