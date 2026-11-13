import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { cutClipRegionSide, getClipSourceTimeAtTime, getTrackClipRegions, splitTrackRegion } from "@/lib/studioClipRegions";

describe("Studio same-track split integration", () => {
  it("retains one track ID and preserves source mapping on both sides", () => {
    const track = { id: 7, startTime: 2, duration: 10, clipStart: 3, fullDuration: 20, waveform: [0.1, 0.4] };
    const split = splitTrackRegion(track, 6, side => `seven-${side}`);
    expect(split.id).toBe(7);
    expect(split.clipRegions).toHaveLength(2);
    const [left, right] = getTrackClipRegions(split);
    expect(left.timelineStart).toBe(2);
    expect(left.sourceStart).toBe(3);
    expect(left.sourceEnd).toBe(7);
    expect(right.timelineStart).toBe(6);
    expect(right.sourceStart).toBe(7);
    expect(right.sourceEnd).toBe(13);
    expect(split.duration).toBe(10);
  });

  it("cuts one side without adding a mixer track or copying removed audio", () => {
    const track = { id: 7, startTime: 0, duration: 10, clipStart: 0, waveform: [0.1] };
    const removeLeft = cutClipRegionSide(track, "region-7-0", 3, { direction: "left" });
    const removeRight = cutClipRegionSide(track, "region-7-0", 7, { direction: "right" });
    expect(removeLeft.removed).toBe(true);
    expect(removeRight.removed).toBe(true);
    expect(removeLeft.id).toBe(track.id);
    expect(removeRight.id).toBe(track.id);
    expect(getTrackClipRegions(removeLeft)[0].sourceStart).toBe(3);
    expect(getTrackClipRegions(removeRight)[0].sourceEnd).toBe(7);
    expect(getTrackClipRegions(removeLeft)).toHaveLength(1);
    expect(getTrackClipRegions(removeRight)).toHaveLength(1);
  });

  it("maps transport times to source offsets and returns silence in a removed gap", () => {
    const track = {
      id: 12, startTime: 0, duration: 10, clipStart: 0,
      clipRegions: [
        { id: "a", timelineStart: 0, sourceStart: 0, sourceEnd: 3 },
        { id: "b", timelineStart: 7, sourceStart: 7, sourceEnd: 10 },
      ],
    };
    expect(getClipSourceTimeAtTime(track, 1)).toBe(1);
    expect(getClipSourceTimeAtTime(track, 5)).toBeNull();
    expect(getClipSourceTimeAtTime(track, 8)).toBe(8);
  });

  it("maps pre-roll and overdub playback through edited clip regions", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const recording = studio.slice(studio.indexOf("const toggleRecord = async () => {"), studio.indexOf("const stop = () => {"));
    expect(recording).toContain("getClipSourceTimeAtTime(track, Math.max(0, recordStartPos - preRoll))");
    expect(recording).toContain("getClipSourceTimeAtTime(track, currentTimeRef.current)");
    expect(recording).toContain("if (sourceTime === null) return");
    expect(recording).not.toContain("recordStartPos - preRoll - (track.startTime || 0)");
    expect(recording).not.toContain("audio.currentTime = currentTimeRef.current;");
  });

  it("hands pre-roll into recording once, without repeating count-in", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    expect(studio).toContain("const recordingFromPreRollRef = useRef(false)");
    expect(studio).toContain("recordingFromPreRollRef.current = true;\n        toggleRecordRef.current()");
    expect(studio).toContain("metronomeEnabled && !skipCountInRef.current && !recordingFromPreRollRef.current");
    expect(studio).toContain("preRoll > 0 && !recordingFromPreRollRef.current");
    expect(studio).toContain("recordingFromPreRollRef.current = false;\n    if (isPlaying)");
    const stop = studio.slice(studio.indexOf("const stop = () => {"), studio.indexOf("const handleCountInComplete =", studio.indexOf("const stop = () => {")));
    expect(stop).toContain("recordingFromPreRollRef.current = false");
  });

  it("blocks new takes and session replacement during recording finalization", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const entrypoints = [
      "const toggleRecord = async () => {",
      "const handleStartBlank = () => {",
      "const handleLoadAutosave = () => {",
      "const handleLoadDemo = async () => {",
      "const handleSessionImport = async (event) => {",
    ];
    for (const marker of entrypoints) {
      const start = studio.indexOf(marker);
      expect(start).toBeGreaterThan(0);
      expect(studio.slice(start, start + 420)).toContain("recordingFinalizePendingRef.current");
    }
    const finalize = studio.slice(studio.indexOf("recorderBeingFinalized.onstop = async"), studio.indexOf("recorderBeingFinalized.stop()"));
    expect(finalize).toContain("catch (error)");
    expect(finalize).toContain("recordingFinalizePendingRef.current = false");
  });

  it("prevents cloud save or backup while an audio take is still finalizing", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    expect(studio).toContain("const recordingFinalizePendingRef = useRef(false)");
    const save = studio.slice(studio.indexOf("const handleSave = async () => {"), studio.indexOf("const handleSaveSessionToDevice = async () => {"));
    expect(save).toContain("isRecording || recordingFinalizePendingRef.current || mediaRecorderRef.current?.state === 'recording'");
    const backup = studio.slice(studio.indexOf("const handleSaveSessionToDevice = async () => {"), studio.indexOf("const handleSessionImport =", studio.indexOf("const handleSaveSessionToDevice = async () => {")));
    expect(backup).toContain("if (recordingFinalizePendingRef.current)");
    const recording = studio.slice(studio.indexOf("const stopRecordingProcess ="), studio.indexOf("const toggleRecord = async"));
    expect(recording).toContain("recordingFinalizePendingRef.current = true;");
    expect(recording).toContain("} finally {\n          recordingFinalizePendingRef.current = false;");
  });

  it("keeps recorded chunks isolated per recorder when another take starts", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const finalize = studio.slice(studio.indexOf("const stopRecordingProcess ="), studio.indexOf("const toggleRecord = async"));
    const start = studio.slice(studio.indexOf("const toggleRecord = async"), studio.indexOf("// Keep ref in sync so the RAF loop"));
    expect(start).toContain("const recordedChunks = [];");
    expect(start).toContain("mediaRecorder.recordedChunks = recordedChunks;");
    expect(start).toContain("if (e.data.size > 0) recordedChunks.push(e.data)");
    expect(finalize).toContain("const recordedChunks = recorderBeingFinalized.recordedChunks || []");
    expect(finalize).toContain("new Blob(recordedChunks, { type: recordingMimeType })");
    expect(finalize).not.toContain("new Blob(audioChunksRef.current");
  });

  it("releases unassigned temporary audio if recorder finalization fails", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const finalize = studio.slice(studio.indexOf("const stopRecordingProcess ="), studio.indexOf("const toggleRecord = async"));
    expect(finalize).toContain("let createdAudioUrl = null;");
    expect(finalize).toContain("let transferredAudioUrl = false;");
    expect(finalize).toContain("createdAudioUrl = audioUrl;");
    expect(finalize).toContain("transferredAudioUrl = hasAudioTarget;");
    expect(finalize).toContain("if (createdAudioUrl && !transferredAudioUrl) URL.revokeObjectURL(createdAudioUrl)");
    expect(finalize).toContain("createdAudioUrl = null;");
  });

  it("preserves existing waveforms on no-recorder Stop and releases audio without an audio target", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const finalize = studio.slice(studio.indexOf("const stopRecordingProcess ="), studio.indexOf("const toggleRecord = async"));
    expect(finalize).toContain("setTracksWithHistory(prev => prev.map(t => t.armed ? { ...t, armed: false } : t))");
    expect(finalize).toContain("const hasAudioTarget = eligibleTargets.some(t => !['midi', 'instrument'].includes(t.type))");
    expect(finalize).toContain("if (!hasAudioTarget) URL.revokeObjectURL(audioUrl)");
    expect(finalize).not.toContain("waveform: [], armed: false");
  });

  it("snapshots stop-time recording duration and avoids erasing clips on empty capture", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const finalize = studio.slice(studio.indexOf("const stopRecordingProcess ="), studio.indexOf("const toggleRecord = async"));
    expect(finalize).toContain("const recordedStopTime = currentTimeRef.current;");
    expect(finalize).toContain("const recordedStartTime = recordingStartTime !== null ? recordingStartTime : recordedStopTime;");
    expect(finalize).toContain("const recordedStopBeat = recordedStopTime * (bpmRef.current / 60);");
    expect(finalize).toContain("const heldMidiNotesAtStop = midiRecordingRef.current");
    expect(finalize).toContain("mediaRecorderRef.current !== recorderBeingFinalized");
    expect(finalize).toContain("startTime: recordedStartTime");
    expect(finalize).toContain("duration: recordedDuration || Math.max(1, recordedStopTime - recordedStartTime)");
    expect(finalize).toContain("matchesRecordingTarget(t) ? { ...t, armed: false } : t");
    expect(finalize).not.toContain("t.armed ? { ...t, waveform: [], armed: false } : t");
  });

  it("ignores recorder finalization after a session reset or track audio replacement", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const finalize = studio.slice(studio.indexOf("const stopRecordingProcess ="), studio.indexOf("const toggleRecord = async"));
    expect(finalize).toContain("const recordingEpoch = historyEpochRef.current");
    expect(finalize).toContain("const recordingTargets = new Map(tracksRef.current.filter(t => t.armed)");
    expect(finalize).toContain("const matchesRecordingTarget = (track) => {");
    expect(finalize).toContain("clipRegions: getTrackClipRegions(track)");
    expect(finalize).toContain("editSignature: JSON.stringify({");
    expect(finalize).toContain("const eligibleTargets = tracksRef.current.filter(matchesRecordingTarget)");
    expect(finalize).toContain("eligibleTargets.length === 0");
    expect(finalize).toContain("if (!matchesRecordingTarget(t)) return t;");
    expect(finalize).toContain("if (recordingEpoch !== historyEpochRef.current) return;");
    expect(finalize).toContain("recordingEpoch !== historyEpochRef.current || eligibleTargets.length === 0");
    expect(finalize).toContain("URL.revokeObjectURL(audioUrl)");
    expect(finalize).toContain("clipRegions: undefined, clipStart: 0");
  });

  it("discards microphone permission granted after Stop or unmount", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    expect(studio).toContain("const recordingRequestGenerationRef = useRef(0)");
    const record = studio.slice(studio.indexOf("const toggleRecord = async () => {"), studio.indexOf("// Keep ref in sync so the RAF loop"));
    expect(record).toContain("const recordingRequestGeneration = ++recordingRequestGenerationRef.current");
    expect(record).toContain("recordingRequestGeneration !== recordingRequestGenerationRef.current");
    expect(record).toContain("stream.getTracks().forEach(input => input.stop())");
    expect(record).toContain("mediaStreamRef.current.getTracks().forEach(input => input.stop())");
    const stop = studio.slice(studio.indexOf("const stop = () => {"), studio.indexOf("const handleCountInComplete ="));
    expect(stop).toContain("recordingRequestGenerationRef.current += 1");
    expect(studio).toContain("recordingRequestGenerationRef.current += 1;\n      if (mediaStreamRef.current)");
  });

  it("keeps the transport clock active until post-roll completes", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const recording = studio.slice(
      studio.indexOf("const toggleRecord = async () => {"),
      studio.indexOf("// Keep ref in sync so the RAF loop")
    );
    expect(recording).toContain("pendingStopAfterRef.current = currentTimeRef.current + postRoll;");
    expect(recording).toContain("transportPlayingRef.current = true;\n        setIsPlaying(true);");
    expect(recording).toContain("invalidateTransportPlayback();\n        setIsPlaying(false);");
    const frame = studio.slice(studio.indexOf("// Post-roll check:"), studio.indexOf("// Punch-in/out:"));
    expect(frame).toContain("currentTimeRef.current >= pendingStopAfterRef.current");
    expect(frame).toContain("invalidateTransportPlayback()");
    expect(frame).toContain("setIsPlaying(false)");
  });

  it("invalidates late pre-roll, post-roll, punch-out and Stop playback callbacks", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    expect(studio).toContain("const invalidateTransportPlayback = () => {");
    expect(studio).toContain("const preRollGeneration = ++transportPlayGenerationRef.current");
    expect(studio).toContain("if (preRollGeneration !== transportPlayGenerationRef.current) return;");
    expect(studio).toContain("transportPlayingRef.current = true;\n      setIsPlaying(true);");
    const stop = studio.slice(studio.indexOf("const stop = () => {"), studio.indexOf("const handleCountInComplete =", studio.indexOf("const stop = () => {")));
    expect(stop).toContain("invalidateTransportPlayback()");
    const postRoll = studio.slice(studio.indexOf("// Post-roll check:"), studio.indexOf("// Punch-in/out:", studio.indexOf("// Post-roll check:")));
    const punchOut = studio.slice(studio.indexOf("// Punch-in/out:"), studio.indexOf("animationFrameId = requestAnimationFrame(updateTime)", studio.indexOf("// Punch-in/out:")));
    expect(postRoll).toContain("invalidateTransportPlayback()");
    expect(punchOut).toContain("invalidateTransportPlayback()");
  });

  it("ignores stale play requests after Stop or a rapid transport restart", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    expect(studio).toContain("const transportPlayingRef = useRef(false)");
    expect(studio).toContain("const transportPlayGenerationRef = useRef(0)");
    expect(studio).toContain("const requestGeneration = ++transportPlayGenerationRef.current");
    expect(studio).toContain("transportPlayingRef.current = !isPlaying");
    expect(studio).toContain("transportPlayGenerationRef.current !== requestGeneration || !transportPlayingRef.current");
    expect(studio).toContain("const shouldPlay = transportPlayingRef.current &&");
    expect(studio).toContain("transportPlayGenerationRef.current += 1;");
  });

  it("deduplicates pending playback starts and blocks stale cross-origin fallback", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    expect(studio).toContain("const pendingAudioStartsRef = useRef(new WeakSet())");
    expect(studio).toContain("audio.paused && !pendingAudioStartsRef.current.has(audio)");
    expect(studio).toContain("pendingAudioStartsRef.current.add(audio)");
    expect(studio).toContain("pendingAudioStartsRef.current.delete(audio)");
    expect(studio).toContain("audioElementsRef.current[track.id] !== audio || audio.crossOrigin !== 'anonymous'");
    expect(studio).toContain("getClipSourceTimeAtTime(liveTrack, currentTimeRef.current) !== null");
    expect(studio).toContain("if (!shouldPlay || audioElementsRef.current[track.id] !== audio) audio.pause()");
  });

  it("respects solo routing and region gain for FX-bypass playback", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const frameStart = studio.indexOf("// Follow audible clip regions, not the track's outer bounds.");
    const frameEnd = studio.indexOf("if (isRecording && recordingStartTime", frameStart);
    expect(frameStart).toBeGreaterThan(0);
    const frame = studio.slice(frameStart, frameEnd);
    expect(frame).toContain("const anySolo = liveTracks.some(item => item.solo)");
    expect(frame).toContain("track.muted || (anySolo && !track.solo)");
    expect(frame).toContain("if (!audio.paused) audio.pause()");
    expect(frame).toContain("audio.dataset?.fxBypass === '1'");
    expect(frame).toContain("getClipRegionGainAtTime(track, region, newTime)");
    expect(frame).toContain("getSiblingCrossfadeGainAtTime(track, region, newTime, liveTracks)");
    expect(frame).toContain("audio.volume = Math.max(0, Math.min(1, baseGain * regionGain))");
  });

  it("updates the mixer gain immediately when seeking into or out of a removed gap", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const start = studio.indexOf("const updateCurrentTime = (newTime) => {");
    const end = studio.indexOf("const togglePlay = () => {", start);
    expect(start).toBeGreaterThan(0);
    const seek = studio.slice(start, end);
    expect(seek).toContain("getClipSourceTimeAtTime(track, newTime)");
    expect(seek).toContain("mixEngineRef.current?.syncClipRegion(track.id, track, null, newTime, tracksRef.current)");
    expect(seek).toContain("mixEngineRef.current?.syncClipRegion(track.id, track, region || null, newTime, tracksRef.current)");
  });

  it("uses region mapping for seek, playback start, and live transport sync", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    expect(studio).toContain("getClipSourceTimeAtTime(track, newTime)");
    expect(studio).toContain("getClipSourceTimeAtTime(track, currentTimeRef.current)");
    expect(studio).toContain("mixEngineRef.current?.syncClipRegion(track.id, track, region || null");
    expect(studio).toContain("if (sourceTime === null)");
    expect(studio).toContain("if (!audio.paused) audio.pause()");
  });

  it("renders edited waveforms in timeline coordinates with visible split boundaries", async () => {
    const [studio, waveform] = await Promise.all([
      readFile("src/pages/Studio.jsx", "utf8"),
      readFile("src/components/studio/TrackWaveformSVG.jsx", "utf8"),
    ]);
    expect(studio).toContain('<div className="absolute inset-0">\n                          <TrackWaveformSVG track={track} />');
    expect(studio).not.toContain('left: `${-(track.clipStart || 0) * 20 * zoom}px`');
    expect(waveform).toContain("const regions = getTrackClipRegions(track)");
    expect(waveform).toContain("region.timelineStart - trackStart");
    expect(waveform).toContain("regions.slice(1).map(region =>");
    expect(waveform).toContain('strokeDasharray="3 2"');
  });

  it("preserves cut and split region metadata through JSON project snapshots", () => {
    const source = { id: "lane-1", startTime: 2, duration: 10, clipStart: 3, fullDuration: 20, waveform: [0.2] };
    const split = splitTrackRegion(source, 6, side => `lane-1-${side}`);
    const cut = cutClipRegionSide(split, "lane-1-right", 9, { direction: "right" });
    expect(cut.removed).toBe(true);
    const cloudState = { version: 1, tracks: [{ ...cut, audioUrl: "https://example.com/audio.wav" }] };
    const zipState = { format: "nalichat-studio-session", version: 2, project: { tracks: cloudState.tracks } };
    for (const saved of [cloudState, zipState.project]) {
      const restored = JSON.parse(JSON.stringify(saved)).tracks[0];
      expect(restored.id).toBe("lane-1");
      expect(restored.clipRegions).toHaveLength(2);
      expect(getTrackClipRegions(restored)).toEqual(getTrackClipRegions(cut));
      expect(getClipSourceTimeAtTime(restored, 8)).toBe(9);
      expect(getClipSourceTimeAtTime(restored, 10)).toBeNull();
    }
  });

  it("cancels queued history timers before replacing a Studio session", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    expect(studio).toContain("const discardPendingHistory = () => {");
    expect(studio).toContain("pendingHistoryRef.current.forEach(entry => clearTimeout(entry.timer))");
    expect(studio).toContain("useEffect(() => () => discardPendingHistory(), [])");
    const resets = [...studio.matchAll(/discardPendingHistory\(\);\s*historyEpochRef\.current \+= 1;/g)];
    expect(resets).toHaveLength(6);
  });

  it("flushes pending region edits before Undo and Redo", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const historyStart = studio.indexOf("const pendingHistoryRef = useRef([])");
    const historyEnd = studio.indexOf("const toggleTrackProperty", historyStart);
    expect(historyStart).toBeGreaterThan(0);
    const history = studio.slice(historyStart, historyEnd);
    expect(history).toContain("const flushPendingHistory = () => {");
    expect(history).toContain("clearTimeout(entry.timer)");
    expect(history).toContain("if (historyEpochRef.current === entry.epoch) pushToHistory(entry.tracks)");
    expect(history).toMatch(/const undo = \(\) => \{\s*flushPendingHistory\(\)/);
    expect(history).toMatch(/const redo = \(\) => \{\s*flushPendingHistory\(\)/);
    expect(history).toContain("if (index < 0) return; // Already flushed by Undo/Redo.");
  });

  it("validates take metadata before cloud save and carries region objects in saved tracks", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    const saveStart = studio.indexOf("const handleSave = async () => {");
    const saveEnd = studio.indexOf("const handleSaveSessionToDevice = async () => {", saveStart);
    const save = studio.slice(saveStart, saveEnd);
    expect(save).toContain("track.playlists != null && !Array.isArray(track.playlists)");
    expect(save).toContain("Cannot save: invalid take playlist metadata.");
    expect(save).toContain("...portableTrackState(track, audioUrl)");
    expect(studio).toContain("...rest,\n    audioUrl,");
    expect(save).toContain("tracks: portableTracks");
  });

  it("separates toolbar Split from directional Cut while keeping backup handlers", async () => {
    const studio = await readFile("src/pages/Studio.jsx", "utf8");
    for (const name of ["handleSaveSessionToDevice", "handleSessionImport",
      "studioDeviceExportInFlightRef", "studioRestoreInFlightRef"]) {
      expect(studio).toContain(name);
    }
    const toolbarSplitStart = studio.indexOf("const splitSelectedTracks = () => {");
    const toolbarSplitEnd = studio.indexOf("const addTrack = () => {", toolbarSplitStart);
    const splitHandler = studio.slice(toolbarSplitStart, toolbarSplitEnd);
    expect(splitHandler).toContain("splitTrackRegion(result, point");
    expect(splitHandler).not.toContain("nextTrackId(");
    expect(splitHandler).not.toContain("updatedTracks = [...updatedTracks, ...additions]");
    const clipStart = studio.indexOf("{/* Audio Region (Clip) */}");
    const pointerDown = studio.indexOf("onPointerDown={(e) =>", clipStart);
    const start = studio.indexOf("if (activeTool === 'cut') {", pointerDown);
    const end = studio.indexOf("if (activeTool === 'scrub')", start);
    expect(start).toBeGreaterThan(pointerDown);
    const cutHandler = studio.slice(start, end);
    expect(cutHandler).toContain("const direction = cutTime < midpoint ? 'left' : 'right'");
    expect(cutHandler).toContain("cutClipRegionSide(track, region.id, cutTime");
    expect(cutHandler).not.toContain("rightClip");
    expect(cutHandler).not.toContain("nextTrackId(");
  });
});
