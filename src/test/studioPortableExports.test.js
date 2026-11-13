import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const source = () => readFile("src/pages/Studio.jsx", "utf8");

describe("NaliStudio portable exports", () => {
  it("does not advertise expired object-URL autosaves as recoverable", async () => {
    const studio = await source();
    expect(studio).toContain("const hasTransientStudioAudio = (tracks)");
    expect(studio).toContain("track.playlists.forEach((take) => sources.push(take?.audioUrl, take?.file_url))");
    expect(studio).toContain("!hasTransientStudioAudio(parsed)");
    expect(studio).toContain("if (hasTransientStudioAudio(parsed))");
    expect(studio).toContain("This autosave contains temporary audio that expired after reload.");
    expect(studio).toContain('window.addEventListener("beforeunload", warnOnUnload)');
    expect(studio).toContain('window.removeEventListener("beforeunload", warnOnUnload)');
    expect(studio).toContain("Save to My Sessions or keep your ZIP backup before leaving.");
  });

  it("preserves restored audio codecs when saving to My Sessions", async () => {
    const studio = await source();
    const start = studio.indexOf("const handleSave = async () => {");
    const end = studio.indexOf("const handleImportClick =", start);
    const handler = studio.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(handler).toContain("studioAudioExtension({");
    expect(handler).toContain("studioAudioMimeForExtension(extension)");
    expect(handler).toContain("const uploadedAudioUrls = new Map()");
    expect(handler).toContain("uploadedAudioUrls.set(source, uploaded.file_url)");
    expect(handler).toContain("for (const take of playlists)");
    expect(handler).toContain("savedPlaylists.push({ ...take, audioUrl: takeUrl, file_url: takeUrl })");
    expect(handler).toContain("playlists: portableTracks[index]?.playlists || track.playlists");
    expect(handler).toContain("unsupported audio format");
    expect(handler).not.toContain('blob.type || "audio/wav"');
  });

  it("exports all rendered stems as one ZIP rather than individual browser downloads", async () => {
    const studio = await source();
    const start = studio.indexOf("const handleExportStems = async () => {");
    const end = studio.indexOf("if (roomId && projectLoading)", start);
    const handler = studio.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(handler).toContain("await renderMixToWav([{ ...track, audioUrl: track.audioUrl || track.file_url }])");
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
    expect(handler).toContain("zip.file(mediaPath, audio)");
    expect(handler).toContain("for (const [takeIndex, take] of playlists.entries())");
    expect(handler).toContain("playlists: savedPlaylists");
    expect(handler).toContain("Too many tracks and takes for a portable backup.");
    expect(handler).toContain("studioAudioExtension({");
    expect(handler).toContain("if (!extension) throw new Error");
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
    expect(handler).toContain('file.name.toLowerCase().endsWith(".nalistudio.json")');
    expect(handler).toContain("Importing it could lose recorded tracks.");
    expect(handler).toContain('Leave the shared Jam Room');
    expect(handler).toContain('tracks.length > 0 && !window.confirm(');
    expect(handler).toContain('Studio session manifest is too large.');
    expect(handler).toContain('Object.values(archive.files).filter((entry) => !entry.dir)');
    expect(handler).toContain("archiveEntries.length > 10001");
    expect(handler).toContain("savedTakeCount > 10000 - payload.project.tracks.length");
    expect(handler).toContain("restoredPlaylists.push({ ...take, audioUrl: takeUrl, file_url: takeUrl })");
    expect(handler).toContain("playlists: restoredPlaylists");
    expect(handler).toContain('totalUncompressedBytes > 1024 * 1024 * 1024');
    expect(handler).toContain('Uncompressed session contents exceed the 1 GB safety limit.');
    expect(handler).toContain('Session audio exceeds the per-track size limit:');
    expect(handler).toContain('archive.file("session.json")');
    expect(handler).toContain('payload.version !== 2');
    expect(handler).toContain("payload.project.tracks.length > MAX_TRACKS");
    expect(handler).toContain("Session contains an invalid audio reference.");
    expect(handler).toContain("studioAudioMimeForExtension(ext)");
    expect(handler).toContain("Session audio file missing:");
    expect(handler).toContain("Session contains duplicate track IDs.");
    expect(handler).toContain("Session contains duplicate audio references.");
    expect(handler).toContain('entry.name !== "session.json" && !restoredAudioPaths.has(entry.name)');
    expect(handler).toContain("Session archive includes unreferenced media files.");
    expect(handler).toContain("Session contains a track with an invalid ID.");
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
