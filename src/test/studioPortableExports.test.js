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

  it("creates collision-resistant take IDs within a track playlist", async () => {
    const studio = await source();
    const start = studio.indexOf("const createTakePlaylist = (track) => {");
    const end = studio.indexOf("const recallTakePlaylist =", start);
    const handler = studio.slice(start, end);
    expect(handler).toContain("setTracksWithHistory(prev => prev.map(current => {");
    expect(handler).toContain("if (current.id !== track.id) return current;");
    expect(handler).toContain("const playlists = Array.isArray(current.playlists)");
    expect(handler).toContain("const usedTakeIds = new Set(");
    expect(handler).toContain("while (usedTakeIds.has(takeId))");
    expect(handler).toContain("id: takeId");
    expect(handler).toContain("playlists: [...playlists, take]");
    expect(handler).not.toContain("const playlists = Array.isArray(track.playlists)");
  });

  it("does not append an identical current Undo snapshot twice", async () => {
    const studio = await source();
    const start = studio.indexOf("const pushToHistory = (newTracks) => {");
    const end = studio.indexOf("const undo =", start);
    const helper = studio.slice(start, end);
    expect(helper).toContain("if (historyRef.current[historyIndexRef.current] === newTracks) return;");
    expect(helper.indexOf("=== newTracks) return;"))
      .toBeLessThan(helper.indexOf("newHistory.push(newTracks)"));
  });

  it("does not reload a cloud session for responsive or unrelated URL changes", async () => {
    const studio = await source();
    const start = studio.indexOf("useEffect(() => {\n    if (!roomId || !user?.id)");
    const end = studio.indexOf("const handleStartBlank =", start);
    const loader = studio.slice(start, end);
    expect(studio).toContain("const waveformPointsRef = useRef(WAVEFORM_POINTS)");
    expect(loader).toContain("generateWaveform(waveformPointsRef.current)");
    expect(loader).toContain("setSearchParams(prev => {");
    expect(loader).toContain(
      "}, [roomId, inviteToken, user?.id, projectLoadRetryKey, setSearchParams]);"
    );
    expect(loader).not.toContain("generateWaveform(WAVEFORM_POINTS)");
    expect(loader).not.toContain("new URLSearchParams(searchParams)");
  });

  it("resets undo history on both cloud-project loading paths", async () => {
    const studio = await source();
    const start = studio.indexOf("if (!roomId || !user?.id)");
    const end = studio.indexOf("const handleStartBlank =", start);
    const loader = studio.slice(start, end);
    expect(loader).toContain("historyRef.current = [hydrated]");
    expect((loader.match(/historyRef\.current = \[hydrated\]/g) || []).length).toBe(2);
    expect(loader).toContain("historyEpochRef.current += 1");
    expect(loader).toContain("if (cancelled) return;");
    expect(loader).toContain("setSelectedTrackIds([])");
    expect(loader).toContain("setFxTarget(null)");
  });

  it("keeps demo generation from restoring old history or overwriting newer edits", async () => {
    const studio = await source();
    const start = studio.indexOf("const handleLoadDemo = async () => {");
    const end = studio.indexOf("// Temporary object URLs", start);
    const demo = studio.slice(start, end);
    expect(demo).toContain("if (isRecording || isPlaying)");
    expect(demo).toContain("Stop recording and playback before loading the demo.");
    expect(demo.indexOf("if (isRecording || isPlaying)"))
      .toBeLessThan(demo.indexOf("historyEpochRef.current += 1"));
    expect(demo).toContain("historyEpochRef.current += 1");
    expect(demo).toContain("historyRef.current = [demoTracks]");
    expect(demo).toContain("if (historyEpochRef.current !== demoEpoch)");
    expect(demo).toContain("track.waveform !== initial.waveform");
    expect(demo).toContain("setTracks(prev => prev.map(track => {");
    expect(demo).toContain("Promise.allSettled([");
    expect(demo).toContain("results.some(result => result.status === \"rejected\")");
    expect(demo).toContain("results.forEach(releaseResult)");
    expect(demo).toContain("toast.dismiss(toastId)");
    expect(demo.indexOf("if (historyEpochRef.current !== demoEpoch)"))
      .toBeLessThan(demo.indexOf('results.some(result => result.status === "rejected")'));
    expect(demo).toContain("pendingDemoAudioCleanupRef.current.push(lead.url, beat.url)");
    expect(demo).toContain("URL.revokeObjectURL(url)");
    expect(demo).not.toContain("setTracks([");
  });

  it("revokes only unused generated demo URLs after React commits the track state", async () => {
    const studio = await source();
    expect(studio).toContain("const pendingDemoAudioCleanupRef = useRef([])");
    expect(studio).toContain("if (!pendingDemoAudioCleanupRef.current.length) return;");
    expect(studio).toContain("pendingDemoAudioCleanupRef.current = []");
    expect(studio).toContain("retainTrackAudio(tracks)");
    expect(studio).toContain("historyRef.current.forEach(retainTrackAudio)");
    expect(studio).toContain("!retained.has(url)");
    expect(studio).toContain("URL.revokeObjectURL(url)");
    expect(studio).toContain("}, [tracks]);");
  });

  it("resets undo history on blank and locally recovered sessions", async () => {
    const studio = await source();
    const start = studio.indexOf("const handleStartBlank = () => {");
    const load = studio.indexOf("const handleLoadAutosave = () => {", start);
    const demo = studio.indexOf("const handleLoadDemo =", load);
    const blank = studio.slice(start, load);
    const autosave = studio.slice(load, demo);
    expect(blank).toContain("studioSaveInFlightRef.current || studioRestoreInFlightRef.current");
    expect(blank).toContain("if (isRecording || isPlaying)");
    expect(blank.indexOf("if (isRecording || isPlaying)"))
      .toBeLessThan(blank.indexOf("historyEpochRef.current += 1"));
    expect(autosave).toContain("studioSaveInFlightRef.current || studioRestoreInFlightRef.current");
    expect(autosave).toContain("if (isRecording || isPlaying)");
    expect(autosave.indexOf("if (isRecording || isPlaying)"))
      .toBeLessThan(autosave.indexOf("historyEpochRef.current += 1"));
    expect(blank).toContain("historyEpochRef.current += 1");
    expect(blank).toContain("historyRef.current = [[]]");
    expect(blank).toContain("historyIndexRef.current = 0");
    expect(autosave).toContain("historyEpochRef.current += 1");
    expect(autosave).toContain("historyRef.current = [parsed]");
    expect(autosave).toContain("setSelectedTrackIds([])");
  });

  it("invalidates queued history callbacks when restoring another session", async () => {
    const studio = await source();
    expect(studio).toContain("const historyEpochRef = useRef(0)");
    expect(studio).toContain("const historyEpoch = historyEpochRef.current");
    expect(studio).toContain("if (historyEpochRef.current === historyEpoch) pushToHistory(next)");
    expect(studio).toContain("historyEpochRef.current += 1");
  });

  it("recalls takes from the latest track and playlist state", async () => {
    const studio = await source();
    const start = studio.indexOf("const recallTakePlaylist = (track, playlistId) => {");
    const end = studio.indexOf("const handleHealSplit =", start);
    const handler = studio.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(handler).toContain("const currentTrack = tracks.find(item => item.id === track.id)");
    expect(handler).toContain("const currentTake = current.playlists?.find(item => item.id === playlistId)");
    expect(handler).toContain("audioUrl: currentTake.audioUrl");
    expect(handler).toContain('toast.error("That take is no longer available.")');
    expect(handler).not.toContain("const take = (track.playlists || []).find");
  });

  it("preserves live editor changes during the first route handoff after project creation", async () => {
    const studio = await source();
    expect(studio).toContain("const newlyCreatedProjectHandoffRef = useRef(null)");
    expect(studio).toContain("if (newlyCreatedProjectHandoffRef.current === roomId)");
    expect(studio).toContain("newlyCreatedProjectHandoffRef.current = null");
    expect(studio).toContain("newlyCreatedProjectHandoffRef.current = targetProjectId");
    const handoff = studio.indexOf("if (newlyCreatedProjectHandoffRef.current === roomId)");
    const load = studio.indexOf("const project = await base44.entities.Project.get(roomId)", handoff);
    expect(handoff).toBeGreaterThan(0);
    expect(load).toBeGreaterThan(handoff);
  });

  it("preserves restored audio codecs when saving to My Sessions", async () => {
    const studio = await source();
    const start = studio.indexOf("const handleSave = async () => {");
    const end = studio.indexOf("const handleImportClick =", start);
    const handler = studio.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(handler).toContain("studioAudioExtension({");
    expect(handler).toContain("studioAudioMimeForExtension(extension)");
    expect(studio).toContain("const studioSaveInFlightRef = useRef(false)");
    expect(studio).toContain("const studioRestoreInFlightRef = useRef(false)");
    expect(handler).toContain("if (studioRestoreInFlightRef.current)");
    expect(handler).toContain("if (studioSaveInFlightRef.current)");
    expect(handler).toContain("studioSaveInFlightRef.current = true;");
    expect(handler).toContain("studioSaveInFlightRef.current = false;");
    expect(handler).toContain("const reason = typeof e?.message");
    expect(handler).toContain('e.message.trim().slice(0, 240)');
    expect(handler).toContain("Could not save Studio project:");
    expect(handler).not.toContain('toast.error("Failed to save project."');
    expect(handler).toContain("} finally {");
    expect(handler).toContain("Cannot save: duplicate Studio track IDs.");
    expect(handler).toContain("Cannot save: duplicate take playlist IDs.");
    expect(handler).toContain("Cannot save: a take playlist has no valid ID.");
    expect(handler).toContain("const uploadedAudioUrls = new Map()");
    const cloudConfirmed = handler.indexOf('throw new Error("Project save was not confirmed.")');
    const localSnapshot = handler.indexOf('localStorage.setItem(autosaveStorageKey, JSON.stringify(portableTracks))');
    expect(cloudConfirmed).toBeGreaterThan(0);
    expect(localSnapshot).toBeGreaterThan(cloudConfirmed);
    expect(handler).not.toContain('throw new Error("This browser could not save the project locally.")');
    expect(handler).toContain("const uploadedUrl = uploaded?.file_url");
    expect(handler).toContain('!/^https:\\/\\//i.test(uploadedUrl)');
    expect(handler).toContain("audio upload did not return a valid secure file URL.");
    expect(handler).toContain("uploadedAudioUrls.set(source, uploadedUrl)");
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
    expect(handler).toContain("Cannot back up: duplicate Studio track IDs.");
    expect(handler).toContain("Cannot back up: duplicate take playlist IDs.");
    expect(handler).toContain("Cannot back up: a take playlist has no valid ID.");
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
    expect(handler).toContain("if (studioSaveInFlightRef.current || studioRestoreInFlightRef.current)");
    expect(handler).toContain("studioRestoreInFlightRef.current = true;");
    expect(handler).toContain("studioRestoreInFlightRef.current = false;");
    expect(handler).toContain("if (isRecording || isPlaying)");
    expect(handler).toContain("Stop playback and recording before restoring a Studio backup.");
    expect(handler).toContain("historyEpochRef.current += 1");
    expect(handler).toContain("historyRef.current = [restoredTracks]");
    expect(handler).toContain("historyIndexRef.current = 0");
    expect(handler).toContain("setHistoryIndex(0)");
    expect(handler).toContain("setTracks(restoredTracks)");
    expect(handler).not.toContain("setTracksWithHistory(restoredTracks)");
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
    expect(handler).toContain("const restoredTakeIds = new Set()");
    expect(handler).toContain("Session contains a take with an invalid ID.");
    expect(handler).toContain("Session contains duplicate take IDs.");
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
