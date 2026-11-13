import { describe, expect, it } from "vitest";
import JSZip from "jszip";
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
  
  it("round-trips track audio and an alternate take inside a v2 ZIP", async () => {
    // Byte-level archive contract test, not a Studio React UI integration test.
    const track = Uint8Array.from([82, 73, 70, 70, 1, 2, 3, 4]);
    const take = Uint8Array.from([73, 68, 51, 9, 8, 7, 6]);
    const trackPath = `audio/track_1.${studioAudioExtension({ mimeType: "audio/wav" })}`;
    const takePath = `audio/track_1_take_1.${studioAudioExtension({ mimeType: "audio/mpeg" })}`;
    const manifest = {
      format: "nalichat-studio-session",
      version: 2,
      project: {
        title: "Roundtrip test",
        tracks: [{
          id: "track-1",
          audioUrl: trackPath,
          file_url: trackPath,
          playlists: [{ id: "take-1", audioUrl: takePath, file_url: takePath }],
        }],
      },
    };
    const zip = new JSZip();
    zip.file("session.json", JSON.stringify(manifest));
    zip.file(trackPath, track);
    zip.file(takePath, take);
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const reopened = await JSZip.loadAsync(bytes);
    const restoredManifest = JSON.parse(await reopened.file("session.json").async("string"));
    expect(restoredManifest).toEqual(manifest);
    expect(await reopened.file(trackPath).async("uint8array")).toEqual(track);
    expect(await reopened.file(takePath).async("uint8array")).toEqual(take);
    expect(studioAudioMimeForExtension(trackPath.split(".").pop())).toBe("audio/wav");
    expect(studioAudioMimeForExtension(takePath.split(".").pop())).toBe("audio/mpeg");
  });

  it("rejects malformed archive bytes", async () => {
    await expect(JSZip.loadAsync(Uint8Array.from([0, 1, 2, 3, 4]))).rejects.toThrow();
  });

});
