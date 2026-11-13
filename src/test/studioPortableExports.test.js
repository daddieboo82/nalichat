import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const source = () => readFile("src/pages/Studio.jsx", "utf8");

describe("NaliStudio portable exports", () => {
  it("does not advertise expired object-URL autosaves as recoverable", async () => {
    const studio = await source();
    expect(studio).toContain("const hasTransientStudioAudio = (tracks)");
    expect(studio).toContain("track.playlists.forEach((take) => sources.push(take?.audioUrl, take?.file_url))");
    expect(studio).toContain("!hasTransientStudioAudio(parsed)");
    expect(studio).toContain("tracks.length === 0 || hasTransientStudioAudio(tracks)) return;");
    expect(studio).toContain("localStorage.setItem(autosaveStorageKey, JSON.stringify(tracks))");
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
    const cloudConfirmed = handler.indexOf('throw new Error("Project save was not confirmed.")');
    const localSnapshot = handler.indexOf('localStorage.setItem(autosaveStorageKey, JSON.stringify(portableTracks))');
    expect(cloudConfirmed).toBeGreaterThan(0);
    expect(localSnapshot).toBeGreaterThan(cloudConfirmed);
    expect(handler).not.toContain('throw new Error("This browser could not save the project locally.")');
    expect(handler).toContain("uploadedAudioUrls.set(source, uploaded.file_url)");
    expect(handler).toContain("for (const take of playlists)");
    expect(handler).toContain("savedPlaylists.push({ ...take, audioUrl: takeUrl, file_url: takeUrl })");
    expect(handler).toContain("const savedTracksById = new Map(portableTracks.map((track) => [String(track.id), track]))");
    expect(handler).toContain("const originalTracksById = new Map(tracks.map((track) => [String(track.id), track]))");
    expect(handler).toContain("const sourceUnchanged =");
    expect(handler).toContain("const savedTakesById = new Map(");
    expect(handler).toContain("const originalTakesById = new Map(");
    expect(handler).toContain("return { ...take, audioUrl: savedTake.audioUrl, file_url: savedTake.file_url }");
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
    expect(handler).toContain("Too many tracks for a restorable Studio backup.");
    expect(handler).toContain("new TextEncoder().encode(manifestText).byteLength");
    expect(handler).toContain("Studio session metadata exceeds the 2 MB restore limit.");
    expect(handler).toContain("Session backup exceeds the 1 GB expanded-size restore limit.");
    expect(handler).toContain("Studio session ZIP exceeds the 1 GB restore limit.");
    expect(handler).toContain("studioAudioExtension({");
    expect(handler).toContain("if (!extension) throw new Error");
    expect(handler).toContain('zip.file("session.json", manifestText)');
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
    expect(handler).toContain("if (isRecording || isPlaying)");
    expect(handler).toContain("Stop playback and recording before restoring a Studio backup.");
    expect(handler).toContain("setSelectedTrackIds([])");
    expect(handler).toContain("setFxTarget(null)");
    expect(handler).toContain('tracks.length > 0 && !window.confirm(');
    expect(handler).toContain('Studio session manifest is too large.');
    expect(handler).toContain('Object.values(archive.files).filter((entry) => !entry.dir)');
    expect(handler).toContain("archiveEntries.length > 10001");
    expect(handler).toContain("savedTakeCount > 10000 - payload.project.tracks.length");
    expect(handler).toContain("restoredPlaylists.push({ ...take, audioUrl: takeUrl, file_url: takeUrl })");
    expect(handler).toContain("playlists: restoredPlaylists");
    expect(handler).toContain("const expandedSize = (entry) => {");
    expect(handler).toContain("Number.isSafeInteger(size)");
    expect(handler).toContain("Studio ZIP contains invalid or unknown expanded file sizes.");
    expect(handler).toContain("sum + expandedSize(entry)");
    expect(handler).toContain("expandedSize(manifest) > 2 * 1024 * 1024");
    expect(handler).toContain("expandedSize(entry) > 512 * 1024 * 1024");
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
    expect(handler).toContain("Session contains conflicting track audio references.");
    expect(handler).toContain("Session contains conflicting take audio references.");
    expect(handler).toContain("audio/track_${trackIndex + 1}");
    expect(handler).toContain("audio/track_${trackIndex + 1}_take_${takeIndex + 1}");
    expect(handler).toContain("const restoreAudioUrl = async (audioPath, expectedPrefix)");
    expect(handler).toContain("audioPath.startsWith(`${expectedPrefix}.`)");
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
