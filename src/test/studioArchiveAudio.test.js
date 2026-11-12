import { describe, expect, it } from "vitest";
import { studioAudioExtension, studioAudioMimeForExtension } from "@/lib/studioArchiveAudio";

describe("portable Studio backup media formats", () => {
  it.each([
    ["audio/wav", "wav"],
    ["audio/x-wav", "wav"],
    ["audio/mpeg", "mp3"],
    ["audio/webm; codecs=opus", "webm"],
    ["audio/ogg", "ogg"],
    ["audio/mp4", "m4a"],
    ["audio/aac", "aac"],
    ["audio/flac", "flac"],
    ["audio/x-aiff", "aiff"],
  ])("maps %s to %s without changing codecs", (mimeType, extension) => {
    expect(studioAudioExtension({ mimeType })).toBe(extension);
    expect(studioAudioMimeForExtension(extension)).toBeTruthy();
  });

  it("uses the original filename when upload metadata is generic", () => {
    expect(studioAudioExtension({ mimeType: "application/octet-stream", filename: "lead.FLAC" })).toBe("flac");
    expect(studioAudioExtension({ mimeType: "", filename: "voice.aif" })).toBe("aiff");
    expect(studioAudioExtension({ mimeType: "", sourceUrl: "https://cdn.example/song.MP3?token=x" })).toBe("mp3");
  });

  it("rejects unknown formats rather than labeling them as WAV", () => {
    expect(studioAudioExtension({ mimeType: "application/octet-stream", filename: "voice.bin" })).toBeNull();
    expect(studioAudioExtension({ mimeType: "video/mp4", filename: "" })).toBeNull();
    expect(studioAudioMimeForExtension("exe")).toBeNull();
  });
});
