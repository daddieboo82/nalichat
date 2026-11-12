import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const source = () => readFile("src/pages/Studio.jsx", "utf8");

describe("NaliStudio portable exports", () => {
  it("exports all rendered stems as one ZIP rather than individual browser downloads", async () => {
    const studio = await source();
    const start = studio.indexOf("const handleExportStems = async () => {");
    const end = studio.indexOf("if (roomId && projectLoading)", start);
    const handler = studio.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(handler).toContain("await renderMixToWav([track])");
    expect(handler).toContain("zip.file(filename, blob)");
    expect(handler).toContain("Object.keys(zip.files).length !== audioTracks.length");
    expect(handler).toContain('a.download = "NaliStudio_stems.zip"');
    expect((handler.match(/a\.click\(\)/g) || []).length).toBe(1);
    expect(handler).toContain("if (!(blob instanceof Blob) || blob.size === 0)");
  });

  it("backs up real track audio files and includes a versioned manifest", async () => {
    const studio = await source();
    const start = studio.indexOf("const handleSaveSessionToDevice = async () => {");
    const end = studio.indexOf("const sessionImportRef =", start);
    const handler = studio.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(handler).toContain("const response = await fetch(source)");
    expect(handler).toContain("zip.file(savedAudioPath, audio)");
    expect(handler).toContain('zip.file("session.json", JSON.stringify(payload, null, 2))');
    expect(handler).toContain('format: "nalichat-studio-session"');
    expect(handler).toContain("version: 2");
    expect(handler).toContain(".nalistudio.zip");
    expect(handler).not.toContain(".nalistudio.json");
  });

  it("rejects corrupt session metadata and shared-room replacement before restoring", async () => {
    const studio = await source();
    const start = studio.indexOf("const handleSessionImport = async (event) => {");
    const end = studio.indexOf("const [isDownloading", start);
    const handler = studio.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(handler).toContain('if (roomId)');
    expect(handler).toContain('Leave the shared Jam Room');
    expect(handler).toContain('tracks.length > 0 && !window.confirm(');
    expect(handler).toContain('Studio session manifest is too large.');
    expect(handler).toContain('Session audio exceeds the per-track size limit:');
    expect(handler).toContain('archive.file("session.json")');
    expect(handler).toContain('payload.version !== 2');
    expect(handler).toContain("payload.project.tracks.length > MAX_TRACKS");
    expect(handler).toContain("Session contains an invalid audio reference.");
    expect(handler).toContain("Session audio file missing:");
    expect(handler).toContain("temporaryUrls.forEach((url) => URL.revokeObjectURL(url))");
    expect(handler).toContain("setTracksWithHistory(restoredTracks)");
  });

  it("exposes the device session restore control", async () => {
    const studio = await source();
    expect(studio).toContain("Restore Device Session (.zip)");
    expect(studio).toContain('ref={sessionImportRef}');
    expect(studio).toContain('onChange={handleSessionImport}');
    expect(studio).toContain('handleSessionImport={handleSessionImport}');
    const welcome = await readFile("src/components/studio/StudioWelcome.jsx", "utf8");
    expect(welcome).toContain("Restore Backup from Device");
    expect(welcome).toContain('onChange={handleSessionImport}');
  });
});
