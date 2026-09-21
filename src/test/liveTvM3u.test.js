import { describe, expect, it } from "vitest";
import { parseM3u } from "@/pages/LiveTV";

describe("Live TV M3U parser", () => {
  it("parses authorized HTTP channels and metadata", () => {
    const result = parseM3u('#EXTM3U\n#EXTINF:-1 tvg-logo="https://example.com/logo.png" group-title="Music",Music Live\nhttps://example.com/live.m3u8');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Music Live", group: "Music", url: "https://example.com/live.m3u8" });
  });

  it("rejects non-http protocols", () => {
    expect(parseM3u("#EXTM3U\n#EXTINF:-1,Local\nfile:///private/video.ts")).toEqual([]);
  });
});
