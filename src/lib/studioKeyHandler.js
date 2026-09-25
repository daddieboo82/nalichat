/**
 * Studio keyboard shortcut handler — extracted from Studio.jsx for line-count management.
 * Returns a keydown event handler wired to all studio state and actions.
 */
export function createStudioKeyHandler(deps) {
  const {
    undo, redo, togglePlay, toggleRecord, stop,
    selectedTrackIds, setSelectedTrackIds,
    deleteSelectedTracks, duplicateSelectedTracks, splitSelectedTracks,
    toggleTrackProperty, addTrack, addVcaTrack, addFolderTrack, setEditMode,
    toggleSolo, toggleMute, setShowFadePresets, setActiveTool, activeTool,
    updateCurrentTime, setSelectionStart, setSelectionEnd,
    selectionStart, selectionEnd, tracks, setLoopActive, loopActive,
    setMetronomeEnabled, metronomeEnabled, handleHealSplit,
    handleToggleGroup, handleRepeatClip, handleSeparateStems,
    handleGenerateMelody, setShowBeatDetective, setTracksWithHistory,
    setShowBigCounter, showBigCounter, setShowAudioSuite,
    handleConsolidateClips, tabToClip, nudgeValue, zoom, currentTimeRef,
    sounds,
  } = deps;

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
    else if (e.key === 'F1') { e.preventDefault(); setEditMode('shuffle'); }
    else if (e.key === 'F2') { e.preventDefault(); setEditMode('slip'); }
    else if (e.key === 'F3') { e.preventDefault(); setEditMode('spot'); }
    else if (e.key === 'F4') { e.preventDefault(); setEditMode('grid'); }
    else if (e.key === 'F5') { e.preventDefault(); setActiveTool('zoomer'); }
    else if (e.key === 'F6') { e.preventDefault(); setActiveTool('trim'); }
    else if (e.key === 'F7') { e.preventDefault(); setActiveTool('selector'); }
    else if (e.key === 'F8') { e.preventDefault(); setActiveTool('grab'); }
    else if (e.key === 'F9') { e.preventDefault(); setActiveTool('scrub'); }
    else if (e.key === 'F10') { e.preventDefault(); setActiveTool('pencil'); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '1') { e.preventDefault(); setActiveTool('zoomer'); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '2') { e.preventDefault(); setActiveTool('trim'); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '3') { e.preventDefault(); setActiveTool('selector'); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '4') { e.preventDefault(); setActiveTool('grab'); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '5') { e.preventDefault(); setActiveTool('scrub'); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '6') { e.preventDefault(); setActiveTool('pencil'); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '7') { e.preventDefault(); setActiveTool('smart'); }
    else if (e.altKey && !e.shiftKey && e.key === '1') { e.preventDefault(); setEditMode('shuffle'); }
    else if (e.altKey && !e.shiftKey && e.key === '2') { e.preventDefault(); setEditMode('slip'); }
    else if (e.altKey && !e.shiftKey && e.key === '3') { e.preventDefault(); setEditMode('spot'); }
    else if (e.altKey && !e.shiftKey && e.key === '4') { e.preventDefault(); setEditMode('grid'); }
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
    else if (e.key === 'Home') { e.preventDefault(); updateCurrentTime(0); }
    else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); setSelectionStart(currentTimeRef.current); if (selectionEnd !== null && currentTimeRef.current >= selectionEnd) setSelectionEnd(null); }
    else if (e.key === 'o' || e.key === 'O') { e.preventDefault(); setSelectionEnd(currentTimeRef.current); if (selectionStart !== null && currentTimeRef.current <= selectionStart) setSelectionStart(null); }
    else if (e.key === 'a' || e.key === 'A') { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); const end = Math.max(...tracks.map(t => (t.startTime||0)+(t.duration||0)), 20); setSelectionStart(0); setSelectionEnd(end); } }
    else if (e.key === 'Escape') {
      e.preventDefault();
      if (e.shiftKey) {
        setSelectionStart(null); setSelectionEnd(null); setSelectedTrackIds([]);
      } else {
        const tools = ['zoomer', 'trim', 'selector', 'grab', 'scrub', 'pencil', 'smart'];
        const index = tools.indexOf(activeTool);
        setActiveTool(tools[(index + 1 + tools.length) % tools.length]);
      }
    }
    else if (e.key === 'Tab') { e.preventDefault();
      const curr = currentTimeRef.current;
      if (e.shiftKey) {
        let prevPeak = null;
        for (const track of tracks) {
          if (!track.waveform || track.waveform.length === 0) continue;
          const trackStart = track.startTime || 0;
          const fullDuration = track.fullDuration || track.duration || 40;
          const posInTrack = curr - trackStart;
          if (posInTrack < 0) continue;
          const startIdx = Math.floor((posInTrack / fullDuration) * track.waveform.length);
          for (let i = startIdx - 2; i > 0; i--) {
            const v = track.waveform[i];
            if (v > 0.25 && v >= (track.waveform[i-1] || 0) && v >= (track.waveform[i+1] || 0)) {
              const peakTime = trackStart + (i / track.waveform.length) * fullDuration;
              if (prevPeak === null || peakTime > prevPeak) prevPeak = peakTime;
              break;
            }
          }
        }
        if (prevPeak !== null) { updateCurrentTime(prevPeak); sounds.nav(); }
      } else {
        let nextPeak = null;
        for (const track of tracks) {
          if (!track.waveform || track.waveform.length === 0) continue;
          const trackStart = track.startTime || 0;
          const fullDuration = track.fullDuration || track.duration || 40;
          const posInTrack = curr - trackStart;
          if (posInTrack < 0) continue;
          const startIdx = Math.floor((posInTrack / fullDuration) * track.waveform.length);
          for (let i = startIdx + 2; i < track.waveform.length - 1; i++) {
            const v = track.waveform[i];
            if (v > 0.25 && v >= (track.waveform[i-1] || 0) && v >= (track.waveform[i+1] || 0)) {
              const peakTime = trackStart + (i / track.waveform.length) * fullDuration;
              if (nextPeak === null || peakTime < nextPeak) nextPeak = peakTime;
              break;
            }
          }
        }
        if (nextPeak !== null) { updateCurrentTime(nextPeak); sounds.nav(); }
      }
    }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); setLoopActive(!loopActive); }
    else if (e.key === '7') { e.preventDefault(); setMetronomeEnabled(!metronomeEnabled); }
    else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); const t = tracks.find(t => selectedTrackIds.includes(t.id)); if (t) handleHealSplit(t); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); const t = tracks.find(t => selectedTrackIds.includes(t.id)); if (t) handleToggleGroup(t); }
    else if (e.shiftKey && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); const t = tracks.find(t => selectedTrackIds.includes(t.id)); if (t) handleRepeatClip(t, 2); }
    else if (e.shiftKey && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); handleSeparateStems(); }
    else if (e.shiftKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); handleGenerateMelody(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); if (selectedTrackIds.length > 0) setShowBeatDetective(true); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '1') { e.preventDefault(); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, height: 40 } : t)); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '2') { e.preventDefault(); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, height: 64 } : t)); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '3') { e.preventDefault(); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, height: 96 } : t)); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '4') { e.preventDefault(); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, height: 160 } : t)); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '5') { e.preventDefault(); setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, height: 240 } : t)); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setShowBigCounter(!showBigCounter); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); if (selectedTrackIds.length > 0) setShowAudioSuite(true); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); handleConsolidateClips(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') { e.preventDefault(); tabToClip(!e.shiftKey); }
    else if (e.key === 'ArrowRight' && !e.shiftKey) { e.preventDefault(); const step = 1 / (20 * zoom); updateCurrentTime(Math.min(100, currentTimeRef.current + step)); }
    else if (e.key === 'ArrowLeft' && !e.shiftKey) { e.preventDefault(); const step = 1 / (20 * zoom); updateCurrentTime(Math.max(0, currentTimeRef.current - step)); }
    else if (e.key === 'ArrowRight' && e.shiftKey && selectedTrackIds.length > 0) { e.preventDefault(); const nudge = nudgeValue; setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, startTime: Math.max(0, (t.startTime || 0) + nudge) } : t)); }
    else if (e.key === 'ArrowLeft' && e.shiftKey && selectedTrackIds.length > 0) { e.preventDefault(); const nudge = nudgeValue; setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, startTime: Math.max(0, (t.startTime || 0) - nudge) } : t)); }
  };
}