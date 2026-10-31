import { getTrackClipRegions, moveClipRegion, moveTrackClipRegions, shuffleMoveClipRegion } from '@/lib/studioClipRegions';

/**
 * Studio keyboard shortcut handler — extracted from Studio.jsx for line-count management.
 * Returns a keydown event handler wired to all studio state and actions.
 */
export function createStudioKeyHandler(deps) {
  const {
    undo, redo, togglePlay, toggleRecord, stop,
    selectedTrackIds, setSelectedTrackIds, selectedClipRegion, setSelectedClipRegion, editMode,
    deleteSelectedTracks, duplicateSelectedTracks, splitSelectedTracks,
    toggleTrackProperty, addTrack, addVcaTrack, addFolderTrack, setEditMode,
    toggleSolo, toggleMute, setShowFadePresets, setActiveTool,
    updateCurrentTime, setSelectionStart, setSelectionEnd,
    selectionStart, selectionEnd, tracks, setLoopActive, loopActive,
    setMetronomeEnabled, metronomeEnabled, handleHealSplit,
    handleToggleGroup, handleRepeatClip, handleSeparateStems,
    handleGenerateMelody, setShowBeatDetective, setTracksWithHistory,
    setShowBigCounter, showBigCounter, setShowAudioSuite,
    handleConsolidateClips, tabToClip, nudgeValue, zoom, currentTimeRef,
    sounds,
  } = deps;

  const nudgeTimelineSelection = (delta) => {
    if (selectedClipRegion) {
      const separator = selectedClipRegion.indexOf(':');
      if (separator > 0) {
        const trackId = selectedClipRegion.slice(0, separator);
        const regionId = selectedClipRegion.slice(separator + 1);
        const selectedTrack = tracks.find(track => String(track.id) === trackId);
        const region = selectedTrack
          ? getTrackClipRegions(selectedTrack).find(item => item.id === regionId)
          : null;
        if (region) {
          const nextStart = Math.max(0, region.timelineStart + delta);
          setTracksWithHistory(previous => previous.map(track => {
            if (String(track.id) !== trackId) return track;
            return editMode === 'shuffle'
              ? shuffleMoveClipRegion(track, regionId, nextStart)
              : moveClipRegion(track, regionId, nextStart);
          }));
          return;
        }
      }
    }

    // With no individual region selected, nudge every region on each selected
    // track together while preserving the gaps between them.
    setTracksWithHistory(previous => previous.map(track =>
      selectedTrackIds.includes(track.id) ? moveTrackClipRegions(track, delta) : track
    ));
  };

  return (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    else if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'Numpad0') { e.preventDefault(); stop(); }
    else if (!e.shiftKey && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); toggleRecord(); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { if (selectedTrackIds.length > 0) { e.preventDefault(); deleteSelectedTracks(); } }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicateSelectedTracks(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); splitSelectedTracks(); }
    else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); selectedTrackIds.forEach(id => toggleTrackProperty(id, 'locked')); }
    else if (e.shiftKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); addTrack(); }
    else if (e.shiftKey && (e.altKey) && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); addVcaTrack(); }
    else if (e.shiftKey && e.altKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); addFolderTrack(); }
    else if (e.shiftKey && e.key === '1') { e.preventDefault(); setEditMode('shuffle'); }
    else if (e.shiftKey && e.key === '2') { e.preventDefault(); setEditMode('slip'); }
    else if (e.shiftKey && e.key === '3') { e.preventDefault(); setEditMode('grid'); }
    else if (e.shiftKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); selectedTrackIds.forEach(id => toggleSolo(id)); }
    else if (e.shiftKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); selectedTrackIds.forEach(id => toggleMute(id)); }
    else if ((e.key === 'm' || e.key === 'M') && !e.shiftKey) { e.preventDefault(); window.dispatchEvent(new CustomEvent('studio-add-marker')); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F') && e.shiftKey) { e.preventDefault(); if (selectedTrackIds.length > 0) setShowFadePresets(true); }
    else if (!e.ctrlKey && !e.metaKey && (e.key === 't' || e.key === 'T')) setActiveTool('trim');
    else if (!e.ctrlKey && !e.metaKey && (e.key === 'c' || e.key === 'C')) setActiveTool('cut');
    else if (!e.ctrlKey && !e.metaKey && (e.key === 'g' || e.key === 'G')) setActiveTool('grab');
    else if (!e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'f' || e.key === 'F')) setActiveTool('fade');
    else if (!e.shiftKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); setActiveTool('scrub'); }
    else if (!e.ctrlKey && !e.metaKey && (e.key === 'e' || e.key === 'E')) setActiveTool('smart');
    else if (e.shiftKey && e.key === '4') { e.preventDefault(); setEditMode('spot'); }
    else if (e.key === 'Home') { e.preventDefault(); updateCurrentTime(0); }
    else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); setSelectionStart(currentTimeRef.current); if (selectionEnd !== null && currentTimeRef.current >= selectionEnd) setSelectionEnd(null); }
    else if (e.key === 'o' || e.key === 'O') { e.preventDefault(); setSelectionEnd(currentTimeRef.current); if (selectionStart !== null && currentTimeRef.current <= selectionStart) setSelectionStart(null); }
    else if (e.key === 'a' || e.key === 'A') { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); const end = Math.max(...tracks.map(t => (t.startTime||0)+(t.duration||0)), 20); setSelectionStart(0); setSelectionEnd(end); } }
    else if (e.key === 'Escape') { e.preventDefault(); setSelectionStart(null); setSelectionEnd(null); setSelectedTrackIds([]); setSelectedClipRegion?.(null); }
    else if (e.key === 'Tab') { e.preventDefault();
      const curr = currentTimeRef.current;
      let targetPeak = null;
      for (const track of tracks) {
        const waveform = track.waveform;
        if (!waveform || waveform.length === 0) continue;
        const regions = getTrackClipRegions(track);
        const sourceDuration = Math.max(
          Number(track.fullDuration) || 0,
          (Number(track.clipStart) || 0) + (Number(track.duration) || 0),
          ...regions.map(region => region.sourceEnd)
        );
        if (sourceDuration <= 0) continue;

        for (const region of regions) {
          const regionDuration = region.sourceEnd - region.sourceStart;
          const regionEnd = region.timelineStart + regionDuration;
          const firstIndex = Math.max(0, Math.floor((region.sourceStart / sourceDuration) * waveform.length));
          const lastIndex = Math.min(waveform.length - 1, Math.ceil((region.sourceEnd / sourceDuration) * waveform.length) - 1);
          if (lastIndex - firstIndex < 2) continue;

          if (e.shiftKey) {
            if (region.timelineStart >= curr) continue;
            const sourceAtCursor = Math.min(
              region.sourceEnd,
              region.sourceStart + Math.max(0, curr - region.timelineStart)
            );
            const cursorIndex = Math.floor((sourceAtCursor / sourceDuration) * waveform.length);
            for (let i = Math.min(lastIndex - 1, cursorIndex - 2); i >= firstIndex + 1; i--) {
              const value = waveform[i];
              if (
                value > 0.25 &&
                value >= (waveform[i - 1] || 0) &&
                value >= (waveform[i + 1] || 0)
              ) {
                const sourceTime = (i / waveform.length) * sourceDuration;
                const peakTime = region.timelineStart + (sourceTime - region.sourceStart);
                if (peakTime < curr - 0.01 && (targetPeak === null || peakTime > targetPeak)) {
                  targetPeak = peakTime;
                }
                break;
              }
            }
          } else {
            if (regionEnd <= curr) continue;
            const sourceAtCursor = Math.max(
              region.sourceStart,
              region.sourceStart + Math.max(0, curr - region.timelineStart)
            );
            const cursorIndex = Math.floor((sourceAtCursor / sourceDuration) * waveform.length);
            for (let i = Math.max(firstIndex + 1, cursorIndex + 2); i < lastIndex; i++) {
              const value = waveform[i];
              if (
                value > 0.25 &&
                value >= (waveform[i - 1] || 0) &&
                value >= (waveform[i + 1] || 0)
              ) {
                const sourceTime = (i / waveform.length) * sourceDuration;
                const peakTime = region.timelineStart + (sourceTime - region.sourceStart);
                if (peakTime > curr + 0.01 && (targetPeak === null || peakTime < targetPeak)) {
                  targetPeak = peakTime;
                }
                break;
              }
            }
          }
        }
      }
      if (targetPeak !== null) { updateCurrentTime(targetPeak); sounds.nav(); }
    }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); setLoopActive(!loopActive); }
    else if (e.key === '7') { e.preventDefault(); setMetronomeEnabled(!metronomeEnabled); }
    else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); const t = tracks.find(t => selectedTrackIds.includes(t.id)); if (t) handleHealSplit(t); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); const t = tracks.find(t => selectedTrackIds.includes(t.id)); if (t) handleToggleGroup(t); }
    else if (e.shiftKey && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); const t = tracks.find(t => selectedTrackIds.includes(t.id)); if (t) handleRepeatClip(t, 2); }
    else if (e.shiftKey && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); handleSeparateStems(); }
    else if (e.shiftKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); handleGenerateMelody(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); if (selectedTrackIds.length > 0) setShowBeatDetective(true); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '1') { e.preventDefault(); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, height: 40 } : t)); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '2') { e.preventDefault(); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, height: 64 } : t)); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '3') { e.preventDefault(); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, height: 96 } : t)); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '4') { e.preventDefault(); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, height: 160 } : t)); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '5') { e.preventDefault(); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, height: 240 } : t)); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setShowBigCounter(!showBigCounter); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); if (selectedTrackIds.length > 0) setShowAudioSuite(true); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); handleConsolidateClips(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') { e.preventDefault(); tabToClip(!e.shiftKey); }
    else if (e.key === 'ArrowRight' && !e.shiftKey) { e.preventDefault(); const step = 1 / (20 * zoom); updateCurrentTime(Math.min(100, currentTimeRef.current + step)); }
    else if (e.key === 'ArrowLeft' && !e.shiftKey) { e.preventDefault(); const step = 1 / (20 * zoom); updateCurrentTime(Math.max(0, currentTimeRef.current - step)); }
    else if (e.key === 'ArrowRight' && e.shiftKey && selectedTrackIds.length > 0) { e.preventDefault(); nudgeTimelineSelection(nudgeValue); }
    else if (e.key === 'ArrowLeft' && e.shiftKey && selectedTrackIds.length > 0) { e.preventDefault(); nudgeTimelineSelection(-nudgeValue); }
  };
}