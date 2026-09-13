import { secureUploadFile } from "@/lib/secureUpload";
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Square, Circle, Mic, Settings2, Volume2, Save, Download, FastForward, Rewind, Maximize2, Pause, Layers, Keyboard, Upload, Activity, Crosshair, Link2, SlidersHorizontal, Wand2, Image as ImageIcon, Users, Video, VideoOff, Loader2, Check, Edit2, ChevronLeft, RefreshCw, ListTodo, AudioLines, Folder } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import BounceDialog from '@/components/studio/BounceDialog';
import Metronome from '@/components/studio/Metronome';
import MarkersBar from '@/components/studio/MarkersBar';
import { sounds } from '@/hooks/use-sound';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePerformance } from '@/hooks/use-performance';


import { useNavigate, useSearchParams } from 'react-router-dom';
import { separateStems, generateMelody, renderMixToWav, renderMixToMp3, audioBufferToWav } from '@/lib/audioProcessing';
import { createMixEngine, needsCrossOrigin } from '@/lib/studioMixEngine';
import { renderInstrumentPhrase, isSynthesizable, getInstrument } from '@/lib/instruments';
import { useStudioPresence } from '@/hooks/useStudioPresence';
import { useAuth } from '@/lib/AuthContext';
import LivePresenceBar from '@/components/studio/LivePresenceBar';
import HardwarePreferencesDialog from '@/components/studio/HardwarePreferencesDialog';
const MixerPanel = lazy(() => import('@/components/studio/MixerPanel'));
import KeyboardShortcutsDialog from '@/components/studio/KeyboardShortcutsDialog';
import TrackWaveformSVG from '@/components/studio/TrackWaveformSVG';
import StudioExtras from '@/components/studio/StudioExtras';
import StudioWelcome from '@/components/studio/StudioWelcome';
import StudioDialogs from '@/components/studio/StudioDialogs';
import JamRoomOverlay from '@/components/studio/JamRoomOverlay';
import StudioToolbar2 from '@/components/studio/StudioToolbar2';
import StudioVideoHelp from '@/components/studio/StudioVideoHelp';
import ExportPurchaseDialog from '@/components/studio/ExportPurchaseDialog';
const PluginRack = lazy(() => import('@/components/studio/PluginRack'));
import TransportCounter from '@/components/studio/TransportCounter';
import CpuMeter from '@/components/studio/CpuMeter';
import CountInIndicator from '@/components/studio/CountInIndicator';
import PreRollPostRoll from '@/components/studio/PreRollPostRoll';
import ClipGainLine from '@/components/studio/ClipGainLine';
import SpotDialog from '@/components/studio/SpotDialog';
import SelectionRegion from '@/components/studio/SelectionRegion';
import AutomationLane from '@/components/studio/AutomationLane';
import CrossfadeOverlay from '@/components/studio/CrossfadeOverlay';
const BeatDetectiveDialog = lazy(() => import('@/components/studio/BeatDetectiveDialog'));
import TrackCommitDialog from '@/components/studio/TrackCommitDialog';
import TrackHeader from '@/components/studio/TrackHeader';
import BigCounter from '@/components/studio/BigCounter';
const AudioSuiteDialog = lazy(() => import('@/components/studio/AudioSuiteDialog'));
import FadePresetsDialog from '@/components/studio/FadePresetsDialog';
import NudgeValueSelector from '@/components/studio/NudgeValueSelector';
import VcaTrackHeader from '@/components/studio/VcaTrackHeader';
import FolderTrackHeader from '@/components/studio/FolderTrackHeader';
import { createStudioKeyHandler } from '@/lib/studioKeyHandler';

const MAX_TRACKS = 999;
const generateWaveform = (len = 8000) => Array.from({ length: len }, (_, i) => Math.min(1, Math.max(0.001, Math.abs((Math.sin(i * 0.1) * Math.cos(i * 0.05)) * (Math.random() * 0.8 + 0.1) * (Math.sin(i * Math.PI / len) * 0.8 + 0.2)) * 2)));

const nextTrackId = (tracks) => {
  const numericIds = tracks
    .map((track) => typeof track.id === 'number' ? track.id : Number(track.id))
    .filter(Number.isFinite);
  return numericIds.length > 0 ? Math.max(...numericIds) + 1 : Date.now();
};

const compactWaveform = (waveform, maxPoints = 1000) => {
  if (!Array.isArray(waveform) || waveform.length <= maxPoints) return waveform || [];
  const step = waveform.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, i) => waveform[Math.floor(i * step)] || 0);
};

const portableTrackState = (track, audioUrl) => {
  const {
    _optimistic,
    _persistedTrackId,
    ...rest
  } = track;
  return {
    ...rest,
    audioUrl,
    file_url: audioUrl,
    waveform: compactWaveform(track.waveform),
    ...(track._persistedTrackId ? { persisted_track_id: track._persistedTrackId } : {}),
  };
};

async function listPersistedTracks(projectId) {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.Track.filter(
      { project_id: projectId },
      "created_date",
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function Studio() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const studioStorageOwner = user?.id || null;
  const masterFxStorageKey = studioStorageOwner ? `nalistudio_master_fx:${studioStorageOwner}` : null;
  const autosaveStorageKey = studioStorageOwner ? `nalistudio_project_autosave:${studioStorageOwner}` : null;
  const [searchParams, setSearchParams] = useSearchParams();
  const roomId = searchParams.get('room');
  const inviteToken = searchParams.get('invite');
  const isMobile = useIsMobile();
  const { isLowEnd } = usePerformance();
  const WAVEFORM_POINTS = isMobile ? 2000 : 8000;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const currentTimeRef = useRef(0);
  const timeDisplayRef = useRef(null);
  const recordingIndicatorRefs = useRef({});
  const recordingCanvasRefs = useRef({});
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const liveWaveformRef = useRef([]);
  const recordingStartRealRef = useRef(null); // performance.now() at recording start for accurate sync
  const [zoom, setZoom] = useState(1);
  const playheadRef = useRef(null);
  const headerPlayheadRef = useRef(null);

  const formatTime = (seconds) => {
    seconds = Math.max(0, seconds || 0);
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  // Millisecond-precision time for surgical editing tooltips
  const formatTimePrecise = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Floating tooltip for precision editing — DOM-direct to avoid re-renders during drag
  const editTooltipRef = useRef(null);
  const showEditTooltip = (x, y, time) => {
    const el = editTooltipRef.current;
    if (!el) return;
    el.style.opacity = '1';
    el.style.left = `${x + 12}px`;
    el.style.top = `${y - 34}px`;
    el.textContent = formatTimePrecise(time);
  };
  const hideEditTooltip = () => {
    if (editTooltipRef.current) editTooltipRef.current.style.opacity = '0';
  };
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioElementsRef = useRef({});
  const mixEngineRef = useRef(null);
  const fxFallbackNotifiedRef = useRef(false);
  if (!mixEngineRef.current) mixEngineRef.current = createMixEngine();
  const fileInputRef = useRef(null);
  const [renamingTrack, setRenamingTrack] = useState(null);
  const [newTrackName, setNewTrackName] = useState("");
  const [creatingTrack, setCreatingTrack] = useState(false);
  const [newTrackType, setNewTrackType] = useState('audio');
  const [newTrackInstrument, setNewTrackInstrument] = useState('default');
  const [newTrackMidiChannel, setNewTrackMidiChannel] = useState('1');
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);

  const maxTracks = MAX_TRACKS;
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  
  const [editMode, setEditMode] = useState('slip'); // slip, grid, shuffle
  const [activeTool, setActiveTool] = useState('grab'); // smart, trim, grab, fade
  const [gridSize, setGridSize] = useState(1);

  const [masterVolume, setMasterVolume] = useState(100);
  const [showMixerPanel, setShowMixerPanel] = useState(false);
  const [loopActive, setLoopActive] = useState(false);
  const loopActiveRef = useRef(false);
  useEffect(() => { loopActiveRef.current = loopActive; }, [loopActive]);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [countInActive, setCountInActive] = useState(false);
  const skipCountInRef = useRef(false);
  const toggleRecordRef = useRef(null);

  // Pro Tools-style Pre-roll / Post-roll for punch-in recording
  const [preRoll, setPreRoll] = useState(0);
  const [postRoll, setPostRoll] = useState(0);
  const pendingRecordStartRef = useRef(null); // time in seconds when actual recording should begin (after pre-roll)
  const pendingStopAfterRef = useRef(null); // time in seconds when playback should stop (after post-roll)

  // Spot mode dialog — lets the user type exact timecode for a clip
  const [spotDialogOpen, setSpotDialogOpen] = useState(false);
  const [spotClip, setSpotClip] = useState(null);

  // Pro Tools-style selection region (in/out points)
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const selectionStartRef = useRef(null);
  const selectionEndRef = useRef(null);
  useEffect(() => { selectionStartRef.current = selectionStart; }, [selectionStart]);
  useEffect(() => { selectionEndRef.current = selectionEnd; }, [selectionEnd]);

  // Session musical settings shown in the transport (BPM, time signature, key)
  const [bpm, setBpm] = useState(120);
  const [bpmInput, setBpmInput] = useState('120');
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [songKey, setSongKey] = useState('C Maj');
  const [audioSettings, setAudioSettings] = useState({ sampleRate: "44.1 kHz", bitDepth: "24-bit", bufferSize: "256" });
  
  const [bounceOpen, setBounceOpen] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project"); const [pendingTimeSignature, setPendingTimeSignature] = useState(null); const [pendingSongKey, setPendingSongKey] = useState(null);
  const [bounceRedirect, setBounceRedirect] = useState(null);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [showQuickMemo, setShowQuickMemo] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showBeatDetective, setShowBeatDetective] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [showBigCounter, setShowBigCounter] = useState(false);
  const [showAudioSuite, setShowAudioSuite] = useState(false);
  const [showFadePresets, setShowFadePresets] = useState(false);
  const [nudgeValue, setNudgeValue] = useState(0.01); // 10ms default nudge
  
  const [hardware, setHardware] = useState({
    mic: false,
    interface: false,
    output: false,
    midi: false
  });
  const [jamRoomActive, setJamRoomActive] = useState(false);
  const [jamVideoActive, setJamVideoActive] = useState(false);
  const [defaultRole, setDefaultRole] = useState("editor");
  const [canEditProject, setCanEditProject] = useState(!roomId);
  const [projectLoading, setProjectLoading] = useState(Boolean(roomId));
  const [projectLoadError, setProjectLoadError] = useState(false);
  const [projectLoadRetryKey, setProjectLoadRetryKey] = useState(0);
  const [isProcessing, setIsProcessing] = useState(null); // 'separate' | 'generate' | null

  // Real-time collaborator presence
  const { peers: livePeers, setActivity } = useStudioPresence(roomId || 'local_studio');
  
  const [tracks, setTracks] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [hasAutosave, setHasAutosave] = useState(false);
  const [showPluginRack, setShowPluginRack] = useState(false);
  // FX target for the plugin rack: 'master' or a track id. null = follow selection.
  const [fxTarget, setFxTarget] = useState(null);
  const [masterFx, setMasterFx] = useState({});
  const selectedPluginTrack = fxTarget === 'master'
    ? null
    : (tracks.find(t => t.id === fxTarget) || tracks.find(t => selectedTrackIds.includes(t.id)));
  const handlePluginsChange = (plugins) => {
    if (fxTarget === 'master') {
      setMasterFx(plugins || {});
      return;
    }
    if (!selectedPluginTrack) {
      toast.error('Select a track first to edit its FX chain');
      return;
    }
    setTracksWithHistory(prev => prev.map(t => (
      t.id === selectedPluginTrack.id ? { ...t, plugins } : t
    )));
  };

  const openTrackFx = (trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) {
      toast.error('That track no longer exists');
      return;
    }
    setFxTarget(trackId);
    setSelectedTrackIds([trackId]);
    setShowPluginRack(true);
  };

  const openMasterFx = () => {
    setFxTarget('master');
    setShowPluginRack(true);
  };

  // Master FX persists to the Project entity when in a room (so it follows the
  // project across devices and collaborators), and to localStorage otherwise.
  // The ref gates saving so we never clobber a collaborator's chain with the
  // empty default before the initial load resolves.
  const masterFxLoadedRef = useRef(false);

  const loadLocalMasterFx = () => {
    if (!masterFxStorageKey) return null;
    try {
      const saved = localStorage.getItem(masterFxStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.error('Failed to load master FX chain', e);
    }
    return null;
  };

  useEffect(() => {
    if (!studioStorageOwner) return;
    setTracks([]);
    setSelectedTrackIds([]);
    setMasterFx({});
    setHasAutosave(false);
    setShowWelcome(true);
    masterFxLoadedRef.current = false;
  }, [studioStorageOwner]);

  useEffect(() => {
    if (!masterFxStorageKey || roomId) return; // room projects load their chain with the project below
    masterFxLoadedRef.current = false;
    const local = loadLocalMasterFx();
    if (local) setMasterFx(local);
    masterFxLoadedRef.current = true;
  }, [roomId, masterFxStorageKey]);

  useEffect(() => {
    if (!masterFxStorageKey || !masterFxLoadedRef.current) return;
    const chain = masterFx || {};
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(masterFxStorageKey, JSON.stringify(chain));
      } catch (e) {
        console.error('Failed to autosave master FX chain', e);
      }
      if (roomId && canEditProject) {
        base44.functions.invoke("mutateProject", {
          projectId: roomId,
          data: { master_fx: chain },
        }).catch(err => console.error('Failed to sync master FX to project', err));
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [masterFx, roomId, canEditProject, masterFxStorageKey]);

  useEffect(() => {
    setHasAutosave(false);
    if (!autosaveStorageKey) return;
    try {
      const saved = localStorage.getItem(autosaveStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) setHasAutosave(true);
      }
    } catch (e) {}
  }, [autosaveStorageKey]);

  useEffect(() => {
    if (!roomId || !user?.id) {
      setProjectLoading(false);
      setProjectLoadError(false);
      return;
    }

    let cancelled = false;
    masterFxLoadedRef.current = false;
    setProjectLoading(true);
    setProjectLoadError(false);

    (async () => {
      try {
        if (inviteToken) {
          const accepted = await base44.functions.invoke("acceptProjectInvite", {
            projectId: roomId,
            token: inviteToken,
          });
          if (accepted?.data?.error) throw new Error(accepted.data.error);
          if (!cancelled) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("invite");
            setSearchParams(nextParams, { replace: true });
          }
        }
        const project = await base44.entities.Project.get(roomId);
        if (!project || cancelled) return;

        const canEdit = project.owner_id === user.id || (project.editor_ids || []).includes(user.id);
        setCanEditProject(Boolean(canEdit));
        setProjectName(project.title || "Untitled Project");
        if (project.bpm) {
          setBpm(project.bpm);
          setBpmInput(String(project.bpm));
        }
        if (project.key) setSongKey(project.key);

        const remote = project.master_fx;
        if (remote && typeof remote === 'object') setMasterFx(remote);
        else {
          const local = loadLocalMasterFx();
          if (local) setMasterFx(local);
        }

        const savedState = project.studio_state;
        if (savedState?.tracks && Array.isArray(savedState.tracks) && savedState.tracks.length > 0) {
          const hydrated = savedState.tracks.map((track) => ({
            ...track,
            audioUrl: track.audioUrl || track.file_url || "",
            waveform: Array.isArray(track.waveform) && track.waveform.length > 0
              ? track.waveform
              : generateWaveform(WAVEFORM_POINTS),
          }));
          setTracks(hydrated);
          if (Number.isFinite(savedState.masterVolume)) setMasterVolume(savedState.masterVolume);
          if (savedState.timeSignature) setTimeSignature(savedState.timeSignature);
        } else {
          const persistedTracks = await listPersistedTracks(roomId);
          if (!cancelled && persistedTracks.length > 0) {
            setTracks(persistedTracks.map((track) => ({
              id: track.id,
              _persistedTrackId: track.id,
              name: track.name,
              type: track.type || "vocal",
              color: track.color || "bg-green-500",
              volume: track.volume ?? 75,
              pan: track.pan ?? 50,
              muted: Boolean(track.muted),
              solo: Boolean(track.solo),
              armed: false,
              waveform: Array.isArray(track.waveform_data) && track.waveform_data.length > 0
                ? track.waveform_data
                : generateWaveform(WAVEFORM_POINTS),
              startTime: 0,
              duration: track.duration || 0,
              audioUrl: track.file_url || "",
              file_url: track.file_url || "",
              locked: false,
              grouped: false,
              showAutomation: false,
              elasticAudio: false,
              fadeIn: 0,
              fadeOut: 0,
            })));
          }
        }

        setShowWelcome(false);
        setJamRoomActive(true);
        if (!cancelled) setProjectLoadError(false);
      } catch (err) {
        console.error("Failed to load project:", err);
        if (!cancelled) setProjectLoadError(true);
        toast.error("Couldn't load this Studio project.");
      } finally {
        if (!cancelled) {
          masterFxLoadedRef.current = true;
          setProjectLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [roomId, inviteToken, WAVEFORM_POINTS, user?.id, projectLoadRetryKey, searchParams, setSearchParams]);

  const handleStartBlank = () => { setTracks([]); setShowWelcome(false); };

  const handleLoadAutosave = () => {
    if (!autosaveStorageKey) {
      toast.error("No autosave found");
      return;
    }
    try {
      const saved = localStorage.getItem(autosaveStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) { setTracks(parsed); setShowWelcome(false); return; }
      }
    } catch (e) {}
    toast.error("No autosave found");
  };

  // Demo audio is generated locally so it always plays (the old hosted sample 404'd)
  const handleLoadDemo = async () => {
    const toastId = toast.loading("Preparing demo session...");
    try {
      const [lead, beat] = await Promise.all([
        generateMelody({ seconds: 20, bpm: 90 }),
        generateMelody({ seconds: 20, bpm: 120 })
      ]);
      const base = { volume: 75, pan: 50, muted: false, solo: false, armed: false, startTime: 0, locked: false, grouped: false, showAutomation: false, elasticAudio: false, fadeIn: 0, fadeOut: 0 };
      setTracks([
        { ...base, id: 1, name: "Demo Lead", color: "bg-purple-500", waveform: lead.waveform, duration: lead.duration, audioUrl: lead.url },
        { ...base, id: 2, name: "Demo Bassline", color: "bg-blue-500", waveform: beat.waveform, duration: beat.duration, audioUrl: beat.url },
      ]);
      setShowWelcome(false);
      toast.success("Demo session ready", { id: toastId });
    } catch (e) {
      console.error("Demo session failed", e);
      toast.error("Couldn't build the demo session", { id: toastId });
    }
  };

  // Autosave tracks (Debounced to prevent lag during rapid edits)
  useEffect(() => {
    if (autosaveStorageKey && tracks && tracks.length > 0) {
      const timeoutId = setTimeout(() => {
        try {
          localStorage.setItem(autosaveStorageKey, JSON.stringify(tracks));
        } catch (e) {
          console.error("Failed to autosave project", e);
        }
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [tracks, autosaveStorageKey]);

  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const tracksRef = useRef(tracks);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    if (!showWelcome && historyRef.current.length === 0) {
      historyRef.current = [tracks];
      historyIndexRef.current = 0;
      setHistoryIndex(0);
    }
  }, [showWelcome, tracks]);

  const pushToHistory = (newTracks) => {
    let newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(newTracks);
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setHistoryIndex(historyIndexRef.current);
  };

  const undo = () => { if (historyIndexRef.current > 0) { historyIndexRef.current -= 1; setHistoryIndex(historyIndexRef.current); setTracks(historyRef.current[historyIndexRef.current]); } };
  const redo = () => { if (historyIndexRef.current < historyRef.current.length - 1) { historyIndexRef.current += 1; setHistoryIndex(historyIndexRef.current); setTracks(historyRef.current[historyIndexRef.current]); } };

  const setTracksWithHistory = (updater) => {
    setTracks(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setTimeout(() => pushToHistory(next), 0);
      return next;
    });
  };

  const toggleTrackProperty = (id, prop) => {
    setTracksWithHistory(prev => prev.map(t => t.id === id ? { ...t, [prop]: !t[prop] } : t));
  };

  const handleReorderTracks = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    sounds.click();
    setTracksWithHistory(prev => {
      const next = Array.from(prev);
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, moved);
      return next;
    });
  };

  // Smooth playback via RAF - Optimized to bypass React render cycle for award-winning performance
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();
    
    const updateTime = (time) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      
      let newTime = currentTimeRef.current + delta;
      // Selection-based loop: when a selection is active and loop is on, loop within the selection
      if (loopActiveRef.current && selectionStartRef.current !== null && selectionEndRef.current !== null) {
        if (newTime >= selectionEndRef.current) newTime = selectionStartRef.current;
      } else if (newTime > 100) newTime = 0; // Loop at 100s
      
      currentTimeRef.current = newTime;
      
      // Update DOM directly for maximum 60fps performance without React reconciliation
      if (timeDisplayRef.current) timeDisplayRef.current.textContent = formatTime(newTime);
      if (playheadRef.current) playheadRef.current.style.left = `${newTime * 20 * zoom}px`;
      if (headerPlayheadRef.current) headerPlayheadRef.current.style.left = `${newTime * 20 * zoom}px`;
      
      if (isRecording && recordingStartTime !== null) {
        // Use real elapsed time (performance.now) for accurate sync with the actual audio recording
        const realElapsed = recordingStartRealRef.current ? (performance.now() - recordingStartRealRef.current) / 1000 : (newTime - recordingStartTime);
        const currentWidth = Math.max(0, realElapsed) * 20 * zoom;
        Object.values(recordingIndicatorRefs.current).forEach(el => {
          if (el) el.style.width = `${currentWidth}px`;
        });
        
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
          let sum = 0;
          for(let i=0; i<dataArrayRef.current.length; i++) {
             const val = (dataArrayRef.current[i] - 128) / 128;
             sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArrayRef.current.length);
          liveWaveformRef.current.push(rms * 4); // Scale up for visibility
          
          Object.values(recordingCanvasRefs.current).forEach(canvas => {
            if (canvas && currentWidth > 0) {
               const ctx = canvas.getContext('2d');
               const height = canvas.height;
               
               // Draw only the latest sample at its time-based x position — O(1) per frame, no canvas clearing
               const points = liveWaveformRef.current;
               const idx = points.length - 1;
               // Match canvas internal resolution to recording pixel width for crisp 1:1 rendering
               const targetW = Math.max(1, Math.ceil(currentWidth));
               if (canvas.width !== targetW) canvas.width = targetW;
               ctx.clearRect(0, 0, canvas.width, height);

               const pts = liveWaveformRef.current;
               if (pts.length < 2) return;

               const centerY = height / 2;
               const maxAmp = height * 0.42;
               // Map each collected RMS sample across the full recording width
               const pixelsPerPoint = canvas.width / pts.length;

               ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
               ctx.lineWidth = 1;
               ctx.beginPath();
               for (let i = 0; i < pts.length; i++) {
                 const px = i * pixelsPerPoint;
                 const amp = Math.min(1, Math.max(0.002, pts[i])) * maxAmp;
                 ctx.moveTo(px, centerY - amp);
                 ctx.lineTo(px, centerY + amp);
               }
               ctx.stroke();

               // Center reference line for zero-crossing precision
               ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
               ctx.lineWidth = 1;
               ctx.beginPath();
               ctx.moveTo(0, centerY);
               ctx.lineTo(canvas.width, centerY);
               ctx.stroke();
            }
          });
        }
      }

      // Pre-roll check: when playhead reaches the pending record start point, begin actual recording
      if (pendingRecordStartRef.current !== null && !isRecording && currentTimeRef.current >= pendingRecordStartRef.current) {
        pendingRecordStartRef.current = null;
        toggleRecordRef.current();
      }

      // Post-roll check: when playhead reaches the pending stop point, stop playback
      if (pendingStopAfterRef.current !== null && currentTimeRef.current >= pendingStopAfterRef.current) {
        pendingStopAfterRef.current = null;
        Object.values(audioElementsRef.current).forEach(audio => audio.pause());
        setIsPlaying(false);
      }

      // Punch-in/out: if recording and a selection is active, auto-stop at selection end
      if (isRecording && selectionStartRef.current !== null && selectionEndRef.current !== null && currentTimeRef.current >= selectionEndRef.current) {
        setIsRecording(false);
        stopRecordingProcess();
        Object.values(audioElementsRef.current).forEach(audio => audio.pause());
        setIsPlaying(false);
      }

      animationFrameId = requestAnimationFrame(updateTime);
    };

    if (isPlaying || isRecording) {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(updateTime);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isRecording, zoom, recordingStartTime]);

  /* ---------------- Mixer / FX realtime plumbing ---------------- */

  // Post-fader gain for a track (mute + solo aware), matching the offline bounce.
  const trackMixGain = (track, allTracks = tracks) => {
    const hasSolo = (allTracks || []).some(t => t.solo);
    const audible = track.muted ? false : (hasSolo ? !!track.solo : true);
    if (!audible) return 0;
    return ((track.volume ?? 75) / 100) * Math.pow(10, (track.clipGain || 0) / 20);
  };

  // Creates (or reuses) the <audio> element for a track and routes it through the
  // FX graph. Falls back to plain element playback if Web Audio routing isn't possible.
  const getTrackAudio = (track) => {
    if (!track?.audioUrl) return null;
    let audio = audioElementsRef.current[track.id];
    if (!audio || audio.dataset?.srcUrl !== track.audioUrl) {
      if (audio) {
        try { audio.pause(); } catch { /* ignore */ }
        mixEngineRef.current?.detach(track.id);
      }
      audio = new Audio();
      audio.preload = 'auto';
      if (needsCrossOrigin(track.audioUrl)) audio.crossOrigin = 'anonymous';
      audio.src = track.audioUrl;
      audio.dataset.srcUrl = track.audioUrl;
      audioElementsRef.current[track.id] = audio;

      // Cross-origin media without CORS headers can't be tapped by Web Audio —
      // retry once without the crossOrigin hint and run that track dry.
      audio.addEventListener('error', () => {
        if (audio.crossOrigin !== 'anonymous') return;
        mixEngineRef.current?.detach(track.id);
        const plain = new Audio();
        plain.preload = 'auto';
        plain.src = track.audioUrl;
        plain.dataset.srcUrl = track.audioUrl;
        plain.dataset.fxBypass = '1';
        plain.volume = trackMixGain(track) * (masterVolume / 100);
        audioElementsRef.current[track.id] = plain;
        if (!fxFallbackNotifiedRef.current) {
          fxFallbackNotifiedRef.current = true;
          toast.warning("Some audio can't be processed in real time (cross-origin file). FX still apply on bounce/export.");
        }
      }, { once: true });
    }

    if (audio.dataset.fxBypass === '1') {
      audio.volume = trackMixGain(track) * (masterVolume / 100);
      return audio;
    }

    mixEngineRef.current?.ensureContext();
    const routed = mixEngineRef.current?.attach(track.id, audio, track);
    if (routed) {
      mixEngineRef.current.syncTrack(track.id, track, { gain: trackMixGain(track) });
      mixEngineRef.current.syncMaster({ masterVolume, masterFx });
    } else {
      audio.dataset.fxBypass = '1';
      audio.volume = trackMixGain(track) * (masterVolume / 100);
    }
    return audio;
  };

  const updateCurrentTime = (newTime) => {
    currentTimeRef.current = newTime;
    if (timeDisplayRef.current) timeDisplayRef.current.textContent = formatTime(newTime);
    if (playheadRef.current) playheadRef.current.style.left = `${newTime * 20 * zoom}px`;
    if (headerPlayheadRef.current) headerPlayheadRef.current.style.left = `${newTime * 20 * zoom}px`;
    Object.values(audioElementsRef.current).forEach(audio => { audio.currentTime = newTime; });
  };

  const togglePlay = () => {
    if (isRecording) {
      setIsRecording(false);
      stopRecordingProcess();
    }
    
    if (!isPlaying) {
      sounds.nav();
      setActivity("Playing the mix ▶️");
      const playPromises = [];
      tracks.forEach(track => {
        if (track.audioUrl && (!track.muted || track.solo)) {
          const audio = getTrackAudio(track);
          if (!audio) return;
          
          // Calculate if playhead is within track bounds
          const trackStart = track.startTime || 0;
          const trackEnd = trackStart + (track.duration || 40);
          const clipStartOffset = track.clipStart || 0;
          
          if (currentTimeRef.current >= trackStart && currentTimeRef.current < trackEnd) {
            audio.currentTime = clipStartOffset + (currentTimeRef.current - trackStart);
            playPromises.push(
              audio.play().catch(e => { console.error("Audio playback error:", e); return { failed: true }; })
            );
          } else {
            audio.pause();
          }
        }
      });
      // Surface a visible error if playback couldn't start at all (e.g. browser blocked it) —
      // previously this failed silently, so the transport looked like it was playing with no sound.
      if (playPromises.length > 0) {
        Promise.all(playPromises).then(results => {
          if (results.every(r => r && r.failed)) {
            toast.error("Playback was blocked by your browser. Click Play again to retry.");
            setIsPlaying(false);
          }
        });
      }
    } else {
      sounds.click();
      Object.values(audioElementsRef.current).forEach(audio => {
        audio.pause();
      });
    }
    
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      Object.values(audioElementsRef.current).forEach(audio => {
        audio.pause();
      });
      mixEngineRef.current?.dispose();
    };
  }, []);

  // Sync mixer state (fader, mute/solo, pan, inserts, sends, master FX) into the live graph
  useEffect(() => {
    const engine = mixEngineRef.current;
    engine?.syncMaster({ masterVolume, masterFx });
    tracks.forEach(track => {
      const audio = audioElementsRef.current[track.id];
      if (!audio) return;
      if (audio.dataset?.fxBypass === '1' || !engine?.isRouted(track.id)) {
        audio.volume = Math.max(0, Math.min(1, trackMixGain(track) * (masterVolume / 100)));
        return;
      }
      engine.syncTrack(track.id, track, { gain: trackMixGain(track, tracks) });
    });
  }, [tracks, masterVolume, masterFx]);

  // Hardware Detection - Refined and Optimized
  useEffect(() => {
    let mounted = true;
    let midiAccessRef = null;

    const checkDevices = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        let hasMic = false;
        let hasInterface = false;
        let hasOutput = false;

        for (const device of devices) {
          if (device.kind === 'audioinput') {
            hasMic = true;
            const label = device.label.toLowerCase();
            if (label && (label.includes('usb') || label.includes('interface') || label.includes('focusrite') || label.includes('steinberg') || label.includes('behringer') || label.includes('universal'))) {
              hasInterface = true;
            }
          }
          if (device.kind === 'audiooutput') {
            hasOutput = true;
          }
        }

        let hasMidi = false;
        if (navigator.requestMIDIAccess) {
          try {
            if (!midiAccessRef) {
              midiAccessRef = await navigator.requestMIDIAccess({ sysex: false });
              midiAccessRef.onstatechange = (e) => {
                if (mounted) {
                   setHardware(prev => ({ ...prev, midi: e.currentTarget.inputs.size > 0 }));
                }
              };
            }
            hasMidi = midiAccessRef.inputs.size > 0;
          } catch (e) {
            console.warn("MIDI access denied or unsupported");
          }
        }

        if (mounted) {
          setHardware({
            mic: hasMic,
            interface: hasInterface,
            output: hasOutput,
            midi: hasMidi
          });
        }
      } catch (err) {
        console.error("Hardware detection error:", err);
      }
    };

    checkDevices();
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', checkDevices);
    }
    
    return () => {
      mounted = false;
      if (navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', checkDevices);
      }
      if (midiAccessRef) {
        midiAccessRef.onstatechange = null;
      }
    };
  }, []);

  const stopRecordingProcess = (keepPlaying = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        const recordingMimeType =
          mediaRecorderRef.current?.mimeType ||
          audioChunksRef.current.find((chunk) => chunk?.type)?.type ||
          'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: recordingMimeType });
        if (blob.size === 0) {
          setTracksWithHistory(prev => prev.map(t => (
            t.armed ? { ...t, waveform: [], armed: false } : t
          )));
          setRecordingStartTime(null);
          toast.error("No audio was captured. Please check your microphone and try again.");
          return;
        }
        const audioUrl = URL.createObjectURL(blob);
        
        let realWaveform = generateWaveform(WAVEFORM_POINTS);
        let recordedDuration = null;
        let waveformAudioCtx = null;
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) throw new Error("Web Audio is not supported");
          waveformAudioCtx = new AudioContextClass();
          const audioBuffer = await waveformAudioCtx.decodeAudioData(arrayBuffer);
          recordedDuration = audioBuffer.duration;
          const channelData = audioBuffer.getChannelData(0);
          
          // Max efficiency waveform generation using Float32Array and striding
          const numPoints = WAVEFORM_POINTS;
          const blockSize = Math.max(1, Math.floor(channelData.length / numPoints));
          const stride = Math.max(1, Math.floor(blockSize / 64)); // Sample max 64 points per block to prevent blocking main thread
          
          const waveform = new Float32Array(numPoints);
          let maxVal = 0;
          
          // Use peak (max) amplitude per block, not the average — an average smooths away
          // the real transients/peaks, making the waveform look nothing like the actual recording.
          for (let i = 0; i < numPoints; i++) {
            let start = i * blockSize;
            let peak = 0;
            for (let j = 0; j < blockSize; j += stride) {
              const abs = Math.abs(channelData[start + j] || 0);
              if (abs > peak) peak = abs;
            }
            waveform[i] = peak;
            if (peak > maxVal) maxVal = peak;
          }
          
          realWaveform = maxVal > 0 ? Array.from(waveform).map(v => v / maxVal) : Array.from(waveform).map(() => 0.05);
        } catch (e) {
          console.error("Failed to parse waveform", e);
        } finally {
          if (waveformAudioCtx && waveformAudioCtx.state !== 'closed') {
            void waveformAudioCtx.close().catch(() => {});
          }
        }
        
        setTracksWithHistory(prev => prev.map(t => {
          if (t.armed) {
            return { 
              ...t, 
              waveform: realWaveform, 
              armed: false, 
              audioUrl, 
              startTime: recordingStartTime !== null ? recordingStartTime : currentTimeRef.current,
              duration: recordedDuration || (recordingStartTime !== null ? Math.max(1, currentTimeRef.current - recordingStartTime) : 10)
            };
          }
          return t;
        }));
        setRecordingStartTime(null);
        toast.success("Recording saved!");
      };
      mediaRecorderRef.current.stop();
    } else {
      setTracksWithHistory(prev => prev.map(t => {
        if (t.armed) {
          return { ...t, waveform: [], armed: false };
        }
        return t;
      }));
      setRecordingStartTime(null);
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    recordingStartRealRef.current = null;
    // Stop overdub playback when recording ends — unless post-roll is keeping it alive
    if (!keepPlaying) {
      Object.values(audioElementsRef.current).forEach(audio => audio.pause());
    }
    sounds.recStop();
  };

  const toggleRecord = async () => {
    if (!isRecording && !tracks.some(t => t.armed)) {
      toast.error("Please arm at least one track to record (click the circle icon on a track)");
      return;
    }
    // Pro Tools count-in: if metronome is on and starting a fresh recording,
    // show a 1-bar count-in overlay first. The onComplete callback re-invokes us.
    if (!isRecording && metronomeEnabled && !skipCountInRef.current) {
      setCountInActive(true);
      return;
    }
    skipCountInRef.current = false;

    // Pre-roll: jump back and start playback so the user hears context before the record point
    if (!isRecording && preRoll > 0) {
      const recordStartPos = currentTimeRef.current;
      pendingRecordStartRef.current = recordStartPos;
      updateCurrentTime(Math.max(0, recordStartPos - preRoll));
      sounds.nav();
      setActivity(`Pre-roll ${preRoll}s → recording 🎙️`);
      // Start playback of existing (non-armed) tracks for context
      tracks.forEach(track => {
        if (!track.armed && track.audioUrl && (!track.muted || track.solo)) {
          const audio = getTrackAudio(track);
          if (!audio) return;
          audio.currentTime = Math.max(0, recordStartPos - preRoll - (track.startTime || 0));
          audio.play().catch(() => {});
        }
      });
      setIsPlaying(true);
      return; // RAF loop will call toggleRecord when playhead reaches recordStartPos
    }

    if (isPlaying) setIsPlaying(false);

    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: false, 
            noiseSuppression: false,
            autoGainControl: false,
            latency: 0
          } 
        });
        mediaStreamRef.current = stream;

        // Overdub: play back existing (non-armed) tracks while recording
        tracks.forEach(track => {
          if (!track.armed && track.audioUrl && (!track.muted || track.solo)) {
            const audio = getTrackAudio(track);
            if (!audio) return;
            audio.currentTime = currentTimeRef.current;
            audio.play().catch(e => console.error("Overdub playback error:", e));
          }
        });
        
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        liveWaveformRef.current = [];
        recordingStartRealRef.current = performance.now();

        // Monitor audio with reduced volume to prevent loud feedback
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.0; // Disabled by default to prevent nasty feedback loops
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Start actual recording with frequent chunks for memory efficiency
        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : {};
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.start(200); // 200ms chunks to reduce memory spikes
        
        setIsRecording(true);
        setRecordingStartTime(currentTimeRef.current);
        setActivity("Recording 🎙️");
        toast.success("Recording started (Mic active)");
        sounds.recStart();
      } catch (err) {
        toast.error("Microphone access denied. Please allow mic permissions in your browser.");
        console.error(err);
      }
    } else {
      setIsRecording(false);
      const hasPostRoll = postRoll > 0;
      stopRecordingProcess(hasPostRoll);
      if (hasPostRoll) {
        // Post-roll: keep playback running for postRoll seconds after recording stops
        pendingStopAfterRef.current = currentTimeRef.current + postRoll;
        setActivity(`Post-roll ${postRoll}s → stopping ⏹️`);
      }
    }
  };

  // Keep ref in sync so the RAF loop can invoke the latest toggleRecord for pre-roll
  toggleRecordRef.current = toggleRecord;

  const stop = () => {
    setIsPlaying(false);
    setCountInActive(false);
    skipCountInRef.current = false;
    pendingRecordStartRef.current = null;
    pendingStopAfterRef.current = null;
    if (isRecording) { setIsRecording(false); stopRecordingProcess(); } else { sounds.recStop(); }
    Object.values(audioElementsRef.current).forEach(a => { a.pause(); a.currentTime = 0; });
    setTimeout(() => updateCurrentTime(0), 10);
  };

  // Called when the count-in overlay finishes its 1-bar count → start actual recording
  const handleCountInComplete = () => {
    setCountInActive(false);
    skipCountInRef.current = true;
    toggleRecord();
  };

  // Keyboard shortcuts — handler logic extracted to src/lib/studioKeyHandler.js
  useEffect(() => {
    const handleKeyDown = createStudioKeyHandler({
      undo, redo, togglePlay, toggleRecord, stop,
      selectedTrackIds, setSelectedTrackIds,
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
    });
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isRecording, togglePlay, toggleRecord, selectedTrackIds, tracks, activeTool]);

  const toggleMute = (trackId) => {
    sounds.click();
    // Mute and Solo are mutually exclusive — enabling mute clears solo.
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted, solo: !t.muted ? false : t.solo } : t));
  };

  const toggleSolo = (trackId) => {
    sounds.click();
    // Mute and Solo are mutually exclusive — enabling solo clears mute.
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, solo: !t.solo, muted: !t.solo ? false : t.muted } : t));
  };

  const toggleArm = (trackId) => {
    sounds.click();
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, armed: !t.armed } : t));
  };

  const updateVolume = (trackId, val) => {
    setTracks(tracks.map(t => t.id === trackId ? { ...t, volume: val[0] } : t));
  };

  const handleTrackClick = (e, trackId) => {
    if (e.ctrlKey || e.metaKey) {
      if (selectedTrackIds.includes(trackId)) {
        setSelectedTrackIds(selectedTrackIds.filter(id => id !== trackId));
      } else {
        setSelectedTrackIds([...selectedTrackIds, trackId]);
      }
    } else {
      setSelectedTrackIds([trackId]);
    }
  };

  const deleteSelectedTracks = () => {
    if (selectedTrackIds.length === 0) return;
    sounds.error();
    selectedTrackIds.forEach(id => {
      const track = tracks.find(t => t.id === id);
      if (audioElementsRef.current[id]) {
        audioElementsRef.current[id].pause();
        audioElementsRef.current[id].src = '';
        delete audioElementsRef.current[id];
        mixEngineRef.current?.detach(id);
      }
      // Revoke object URLs to free memory from blob-based audio
      if (track?.audioUrl?.startsWith('blob:')) {
        try { URL.revokeObjectURL(track.audioUrl); } catch (e) {}
      }
    });
    setTracksWithHistory(tracks.filter(t => !selectedTrackIds.includes(t.id)));
    setSelectedTrackIds([]);
    toast.success("Selected tracks deleted");
  };

  const duplicateSelectedTracks = () => {
    if (selectedTrackIds.length === 0) return;
    sounds.success();
    
    if (tracks.length + selectedTrackIds.length > maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). You have reached the current studio limit.`);
      return;
    }

    const newTracks = [];
    let nextId = nextTrackId(tracks);

    tracks.forEach(t => {
      if (selectedTrackIds.includes(t.id)) {
        newTracks.push({
          ...t,
          id: nextId++,
          name: `${t.name} (Copy)`
        });
      }
    });

    setTracksWithHistory([...tracks, ...newTracks]);
    setSelectedTrackIds([]);
    toast.success("Tracks duplicated");
  };

  const deleteTrack = (trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (audioElementsRef.current[trackId]) {
      audioElementsRef.current[trackId].pause();
      audioElementsRef.current[trackId].src = '';
      delete audioElementsRef.current[trackId];
    }
    if (track?.audioUrl?.startsWith('blob:')) {
      try { URL.revokeObjectURL(track.audioUrl); } catch (e) {}
    }
    setTracksWithHistory(prev => prev.filter(t => t.id !== trackId));
    setSelectedTrackIds(prev => prev.filter(id => id !== trackId));
    toast.success("Track deleted");
  };
  const duplicateTrack = (track) => {
    if (tracks.length >= maxTracks) return toast.error(`Track limit reached (${maxTracks}). You have reached the current studio limit.`);
    const nextId = nextTrackId(tracks);
    setTracksWithHistory(prev => [...prev, { ...track, id: nextId, name: `${track.name} (Copy)` }]); toast.success("Track duplicated");
  };

  // Pro Tools-style Heal Split: rejoin two clips that were split from the same source.
  // Finds the "other half" (same splitFrom parent) and merges them back into one clip.
  const handleHealSplit = (track) => {
    if (!track.splitFrom) {
      toast.error("This clip wasn't split — nothing to heal.");
      return;
    }
    // Find the sibling clip that shares the same splitFrom id
    const sibling = tracks.find(t => t.id !== track.id && t.splitFrom === track.splitFrom);
    if (!sibling) {
      toast.error("Can't find the other half of this split.");
      return;
    }
    // Determine which is left and which is right
    const [left, right] = (track.startTime || 0) < (sibling.startTime || 0) ? [track, sibling] : [sibling, track];
    const mergedDuration = (left.duration || 0) + (right.duration || 0);
    setTracksWithHistory(prev => prev
      .map(t => t.id === left.id ? { ...t, duration: mergedDuration, splitFrom: undefined, clipStart: left.clipStart || 0, fullDuration: left.fullDuration || mergedDuration } : t)
      .filter(t => t.id !== right.id)
    );
    toast.success("Split healed — clips rejoined.");
    sounds.nav();
  };

  // Pro Tools-style Repeat Clip: duplicate a clip N times to the right, end-to-end.
  const handleRepeatClip = (track, count) => {
    if (tracks.length + count - 1 > maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). You have reached the current studio limit.`);
      return;
    }
    const clipDur = track.duration || 40;
    const clipStart = track.startTime || 0;
    let nextId = nextTrackId(tracks);
    const newClips = [];
    for (let i = 1; i <= count; i++) {
      newClips.push({
        ...track,
        id: nextId++,
        name: `${track.name} (Repeat ${i})`,
        startTime: clipStart + clipDur * i,
        splitFrom: track.id,
        armed: false,
      });
    }
    setTracksWithHistory(prev => [...prev, ...newClips]);
    toast.success(`Clip repeated ${count}×`);
    sounds.success();
  };

  // Pro Tools-style Consolidate Clips: render selected clips to new audio files
  const handleConsolidateClips = async () => {
    const selected = tracks.filter(t => selectedTrackIds.includes(t.id) && t.audioUrl);
    if (selected.length === 0) {
      toast.error("Select at least one clip with audio to consolidate.");
      return;
    }
    setIsDownloading(true);
    toast.info(`Consolidating ${selected.length} clip${selected.length > 1 ? 's' : ''}...`);
    try {
      for (const track of selected) {
        let audioCtx = null;
        try {
          const response = await fetch(track.audioUrl);
          if (!response.ok) throw new Error(`Failed to load ${track.name || "clip"}: ${response.status}`);
          const arrayBuffer = await response.arrayBuffer();
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) throw new Error("Web Audio is not supported");
          audioCtx = new AudioContextClass();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

          // Apply clip start offset and duration trimming.
          const clipStart = Math.max(0, track.clipStart || 0);
          const clipDuration = track.duration || Math.max(0, audioBuffer.duration - clipStart);
          const startSample = Math.min(audioBuffer.length, Math.floor(clipStart * audioBuffer.sampleRate));
          const endSample = Math.min(
            audioBuffer.length,
            startSample + Math.floor(clipDuration * audioBuffer.sampleRate),
          );
          if (endSample <= startSample) throw new Error("Selected clip has no audio to consolidate");

          const trimmedBuffer = audioCtx.createBuffer(
            audioBuffer.numberOfChannels,
            endSample - startSample,
            audioBuffer.sampleRate,
          );
          for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            const sourceChannel = audioBuffer.getChannelData(ch);
            const destinationChannel = trimmedBuffer.getChannelData(ch);
            destinationChannel.set(sourceChannel.subarray(startSample, endSample));
          }

          // Encode the actual trimmed buffer. The previous path decoded/truncated
          // the clip but then exported the original track again.
          const wavBlob = audioBufferToWav(trimmedBuffer);
          const url = URL.createObjectURL(wavBlob);
          try {
            const a = document.createElement('a');
            a.href = url;
            a.download = `${track.name.replace(/[^a-z0-9]/gi, '_')}_consolidated.wav`;
            document.body.appendChild(a);
            a.click();
            a.remove();
          } finally {
            URL.revokeObjectURL(url);
          }
        } finally {
          if (audioCtx && audioCtx.state !== 'closed') {
            await audioCtx.close().catch(() => {});
          }
        }
      }
      toast.success(`${selected.length} clip${selected.length > 1 ? 's' : ''} consolidated!`);
    } catch (e) {
      console.error('Consolidate failed:', e);
      toast.error("Consolidation failed.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Pro Tools-style Tab to Next/Prev Clip: navigate between clip boundaries
  const tabToClip = (forward) => {
    const curr = currentTimeRef.current;
    const clipBoundaries = [];
    tracks.forEach(t => {
      if (!t.waveform || t.waveform.length === 0) return;
      const start = t.startTime || 0;
      const end = start + (t.duration || 40);
      clipBoundaries.push(start, end);
    });
    clipBoundaries.sort((a, b) => a - b);
    if (forward) {
      const next = clipBoundaries.find(b => b > curr + 0.01);
      if (next !== undefined) { updateCurrentTime(next); sounds.nav(); }
    } else {
      const prev = [...clipBoundaries].reverse().find(b => b < curr - 0.01);
      if (prev !== undefined) { updateCurrentTime(prev); sounds.nav(); }
    }
  };

  // Pro Tools-style Track Groups: link selected tracks for synchronized editing.
  const handleToggleGroup = (track) => {
    if (track.groupId) {
      // Ungroup: clear groupId on all tracks in this group
      setTracksWithHistory(prev => prev.map(t => t.groupId === track.groupId ? { ...t, groupId: undefined } : t));
      toast.success("Track ungrouped.");
    } else {
      // Group: assign a new groupId to all selected tracks (or just this one if none selected)
      const groupTargets = selectedTrackIds.length > 0 ? selectedTrackIds : [track.id];
      const newGroupId = `grp_${Date.now()}`;
      setTracksWithHistory(prev => prev.map(t => groupTargets.includes(t.id) ? { ...t, groupId: newGroupId } : t));
      toast.success(`${groupTargets.length} track${groupTargets.length > 1 ? 's' : ''} grouped.`);
    }
    sounds.click();
  };

  const splitSelectedTracks = () => {
    if (selectedTrackIds.length === 0) return;
    sounds.click();
    
    if (tracks.length + selectedTrackIds.length > maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). You have reached the current studio limit.`);
      return;
    }

    let nextId = nextTrackId(tracks);
    let splitCount = 0;
    
    const newTracksList = [];

    const updatedTracks = tracks.map(t => {
      if (selectedTrackIds.includes(t.id) && t.waveform && t.waveform.length > 0) {
        const clipStart = t.startTime !== undefined ? t.startTime : 0;
        const clipDuration = t.duration !== undefined ? t.duration : 40;
        const clipEnd = clipStart + clipDuration;
        const curr = currentTimeRef.current;
        
        if (curr > clipStart && curr < clipEnd) {
          const splitDuration = curr - clipStart;
          
          splitCount++;
          
          newTracksList.push({
            ...t,
            id: nextId++,
            name: `${t.name} (Cut)`,
            startTime: curr,
            duration: clipDuration - splitDuration,
            fullDuration: t.fullDuration || t.duration,
            clipStart: (t.clipStart || 0) + splitDuration,
            splitFrom: t.id
          });

          return {
            ...t,
            duration: splitDuration,
            fullDuration: t.fullDuration || t.duration,
            clipStart: t.clipStart || 0,
            splitFrom: t.id
          };
        }
      }
      return t;
    });

    if (splitCount > 0) {
      setTracksWithHistory([...updatedTracks, ...newTracksList]);
      toast.success("Clip split at playhead");
    } else {
      toast.error("Playhead is not positioned over the selected clip");
    }
  };

  const addTrack = () => {
    sounds.click();
    setActivity("Adding a track ➕");
    if (tracks.length >= maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). You have reached the current studio limit.`);
      return;
    }
    const newId = nextTrackId(tracks);
    setNewTrackName(`New Track ${newId}`);
    setNewTrackType('audio');
    setCreatingTrack(true);
  };
  const handleCreateTrackConfirm = () => {
    if (!newTrackName.trim()) return;
    const newId = nextTrackId(tracks);
    const isInstrument = newTrackType === 'midi' || newTrackType === 'instrument';
    setTracksWithHistory([...tracks, {
      id: newId, name: newTrackName.trim(), type: newTrackType,
      color: ["bg-green-500", "bg-blue-500", "bg-purple-500", "bg-yellow-500", "bg-pink-500"][newId % 5],
      volume: 75, pan: 50, muted: false, solo: false, armed: false, waveform: [], startTime: 0, duration: 0,
      // Instrument choice is persisted so the track can actually be rendered later.
      ...(isInstrument ? { instrument: newTrackInstrument, midiChannel: newTrackMidiChannel } : {}),
    }]);
    setCreatingTrack(false);
    setSelectedTrackIds([newId]);
    toast.success(isInstrument
      ? `${getInstrument(newTrackInstrument).name} track added — press Render to generate audio`
      : "Track added");
  };

  // Render a phrase for a Software Instrument / MIDI track using the session's
  // key and tempo, turning the instrument choice into real, mixable audio.
  const renderInstrumentTrack = async (trackId) => {
    const track = tracksRef.current.find(t => t.id === trackId);
    if (!track) return;
    const instrumentId = track.instrument || 'default';
    if (!isSynthesizable(instrumentId)) {
      toast.error("External MIDI routes to outboard gear — record its audio input instead.");
      return;
    }
    setIsProcessing('instrument');
    const toastId = toast.loading(`Rendering ${getInstrument(instrumentId).name}...`);
    try {
      const { url, waveform, duration } = await renderInstrumentPhrase({
        instrument: instrumentId,
        bpm,
        songKey,
        bars: 4,
      });
      setTracksWithHistory(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        if (t.audioUrl?.startsWith('blob:')) { try { URL.revokeObjectURL(t.audioUrl); } catch (e) { /* ignore */ } }
        return { ...t, audioUrl: url, waveform, duration, fullDuration: duration, clipStart: 0 };
      }));
      toast.success(`${getInstrument(instrumentId).name} rendered`, { id: toastId });
      sounds.success();
    } catch (e) {
      console.error('Instrument render failed', e);
      toast.error(e.message || "Couldn't render this instrument.", { id: toastId });
    } finally {
      setIsProcessing(null);
    }
  };

  // Pro Tools-style VCA Master Track: controls volume of assigned member tracks
  const addVcaTrack = () => {
    sounds.click();
    const newId = nextTrackId(tracks);
    setTracksWithHistory([...tracks, { id: newId, name: `VCA Master ${newId}`, trackType: 'vca', color: 'bg-accent', volume: 100, vcaMembers: [], muted: false, solo: false, armed: false, waveform: [], startTime: 0, duration: 0 }]);
    toast.success("VCA Master track added");
  };

  // Pro Tools-style Folder Track: collapsible container for grouping tracks
  const addFolderTrack = () => {
    sounds.click();
    const newId = nextTrackId(tracks);
    setTracksWithHistory([...tracks, { id: newId, name: `Folder ${newId}`, trackType: 'folder', color: 'bg-primary', collapsed: false, folderMembers: [], muted: false, solo: false, armed: false, waveform: [], startTime: 0, duration: 0 }]);
    toast.success("Folder track added");
  };

  const toggleFolderCollapse = (folderId) => {
    sounds.click();
    setTracksWithHistory(prev => prev.map(t => t.id === folderId ? { ...t, collapsed: !t.collapsed } : t));
  };

  const handleSeparateStems = async () => {
    if (selectedTrackIds.length === 0) {
      toast.error("Please select a track to separate");
      return;
    }
    const track = tracks.find(t => t.id === selectedTrackIds[0]);
    if (!track || !track.audioUrl) {
      toast.error("Selected track has no audio. Record or import audio first.");
      return;
    }
    if (tracks.length + 2 > maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). You have reached the current studio limit.`);
      return;
    }
    setIsProcessing('separate');
    const toastId = toast.loading("Analyzing and separating audio stems...");
    
    if (track.audioUrl.includes('actions.google.com')) {
      toast.error("Demo tracks are not suitable for stem separation. Please import your own audio files.", { id: toastId });
      setIsProcessing(null);
      return;
    }

    try {
      const { vocals, instrumental } = await separateStems(track.audioUrl);
      let nextId = Math.max(...tracks.map(t => t.id)) + 1;
      setTracksWithHistory(prev => [...prev,
        { ...track, id: nextId, name: `${track.name} (Vocals/Highs)`, color: "bg-green-500", audioUrl: vocals.url, waveform: vocals.waveform, duration: vocals.duration, startTime: track.startTime || 0, segments: undefined, effects: undefined },
        { ...track, id: nextId + 1, name: `${track.name} (Instrumental/Lows)`, color: "bg-green-500", audioUrl: instrumental.url, waveform: instrumental.waveform, duration: instrumental.duration, startTime: track.startTime || 0, segments: undefined, effects: undefined }
      ]);
      toast.success("Stems separated successfully!", { id: toastId });
    } catch (e) {
      console.error("Stem separation error:", e);
      toast.error(
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-red-500">Stem Separation Failed</span>
          <span className="text-xs opacity-90">We couldn't process this track. Ensure it's a valid WAV or MP3 file and try again.</span>
          {e.message && <span className="text-[10px] bg-black/20 p-1.5 rounded font-mono mt-1 overflow-x-auto text-red-400">{e.message}</span>}
        </div>, 
        { id: toastId, duration: 8000 }
      );
    } finally {
      setIsProcessing(null);
    }
  };

  const handleGenerateMelody = async () => {
    if (tracks.length >= maxTracks) {
      toast.error(`Track limit reached (${maxTracks}). You have reached the current studio limit.`);
      return;
    }
    setIsProcessing('generate');
    toast.info("Generating melody...");
    try {
      const { url, waveform, duration } = await generateMelody({ seconds: 8, bpm: 120 });
      const newId = nextTrackId(tracks);
      const colors = ["bg-green-500"];
      setTracksWithHistory(prev => [...prev, {
        id: newId,
        name: "Generated Melody",
        color: colors[newId % colors.length],
        volume: 75, pan: 50, muted: false, solo: false, armed: false,
        waveform, startTime: 0, duration, audioUrl: url,
        locked: false, grouped: false, showAutomation: false, elasticAudio: false, fadeIn: 0, fadeOut: 0
      }]);
      toast.success("Melody generated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate melody.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSave = async () => {
    if (roomId && !canEditProject) {
      toast.error("This Jam Room invite is view-only. Your changes cannot be saved to the shared project.");
      return false;
    }

    const toastId = toast.loading("Saving Studio project...");
    try {
      const portableTracks = [];
      for (const track of tracks) {
        let audioUrl = track.audioUrl || track.file_url || "";

        // blob: URLs are device-local and die after reload. Upload them before
        // persisting so the project can reopen on another device.
        if (audioUrl.startsWith("blob:")) {
          const response = await fetch(audioUrl);
          const blob = await response.blob();
          const extension = blob.type.includes("mpeg") ? "mp3" : blob.type.includes("webm") ? "webm" : "wav";
          const safeName = (track.name || "track").replace(/[^a-z0-9_-]+/gi, "_");
          const file = new File([blob], `${safeName}.${extension}`, { type: blob.type || "audio/wav" });
          const uploaded = await secureUploadFile({ file });
          audioUrl = uploaded.file_url;
        }

        portableTracks.push(portableTrackState(track, audioUrl));
      }

      const studioState = {
        version: 1,
        saved_at: new Date().toISOString(),
        tracks: portableTracks,
        masterVolume,
        timeSignature,
      };

      if (autosaveStorageKey) {
        localStorage.setItem(autosaveStorageKey, JSON.stringify(portableTracks));
      }
      if (masterFxStorageKey) {
        localStorage.setItem(masterFxStorageKey, JSON.stringify(masterFx || {}));
      }

      if (roomId) {
        const saved = await base44.functions.invoke("mutateProject", {
          projectId: roomId,
          data: {
            title: projectName,
            bpm,
            key: songKey,
            master_fx: masterFx || {},
            studio_state: studioState,
          },
        });
        if (saved?.data?.error) throw new Error(saved.data.error);
      }

      // Replace transient blob URLs in memory with their uploaded URLs so future
      // saves do not re-upload the same audio.
      setTracks((prev) => prev.map((track, index) => ({
        ...track,
        audioUrl: portableTracks[index]?.audioUrl || track.audioUrl,
        file_url: portableTracks[index]?.file_url || track.file_url,
      })));

      toast.success("Project saved successfully!", { id: toastId });
      return true;
    } catch (e) {
      console.error("Studio save failed", e);
      toast.error("Failed to save project.", { id: toastId });
      return false;
    }
  };

  const handleImportClick = () => {
    setShowImportDialog(true);
  };

  const decodeWaveform = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const numPoints = WAVEFORM_POINTS;
      const blockSize = Math.max(1, Math.floor(channelData.length / numPoints));
      const stride = Math.max(1, Math.floor(blockSize / 64));
      const waveform = new Float32Array(numPoints);
      let maxVal = 0;
      for (let i = 0; i < numPoints; i++) {
        const start = i * blockSize;
        let sum = 0, samples = 0;
        for (let j = 0; j < blockSize; j += stride) {
          sum += Math.abs(channelData[start + j] || 0);
          samples++;
        }
        const val = sum / (samples || 1);
        waveform[i] = val;
        if (val > maxVal) maxVal = val;
      }
      audioCtx.close();
      const normalized = maxVal > 0 ? Array.from(waveform).map(v => v / maxVal) : Array.from(waveform).map(() => 0.05);
      return { waveform: normalized, duration: audioBuffer.duration };
    } catch (err) {
      console.error("Failed to decode audio file", err);
      return { waveform: generateWaveform(WAVEFORM_POINTS), duration: 40 };
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (tracks.length >= maxTracks) {
        toast.error(`Track limit reached (${maxTracks}). You have reached the current studio limit.`);
        e.target.value = null;
        return;
      }
      
      const newId = nextTrackId(tracks);
      const colors = ["bg-green-500"];
      const fileUrl = URL.createObjectURL(file);

      toast.info(`Importing ${file.name}...`);
      const { waveform, duration } = await decodeWaveform(file);
      
      setTracksWithHistory([...tracks, {
        id: newId,
        name: file.name,
        color: colors[newId % colors.length],
        volume: 75,
        pan: 50,
        muted: false,
        solo: false,
        armed: false,
        waveform,
        startTime: 0,
        duration: Math.max(1, duration),
        audioUrl: fileUrl,
        locked: false,
        grouped: false,
        showAutomation: false,
        elasticAudio: false,
        fadeIn: 0,
        fadeOut: 0
      }]);
      toast.success(`Imported ${file.name}`);
      e.target.value = null;
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('wav');

  const handleDownloadMix = async (format = 'wav') => {
    if (!tracks.some(t => t.audioUrl)) {
      toast.error("No audio to export. Record or import a track first.");
      return;
    }
    setIsDownloading(true);
    toast.info(`Rendering your mix to ${format.toUpperCase()}...`);
    try {
      const mixOptions = { masterVolume, masterFx };
      const blob = format === 'mp3' ? await renderMixToMp3(tracks, mixOptions) : await renderMixToWav(tracks, mixOptions);
      if (!blob) {
        toast.error("Nothing to export (all tracks muted or empty).");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NaliStudio Mix ${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      sounds.success();
      toast.success("Mix downloaded to your device!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export mix.");
    } finally {
      setIsDownloading(false);
    }
  };

  // handleExport removed in favor of BounceDialog

  // Export each track as a separate stem file — Pro Tools "Export Stems" workflow
  const handleExportStems = async () => {
    const audioTracks = tracks.filter(t => t.audioUrl && !t.muted);
    if (audioTracks.length === 0) {
      toast.error("No audio tracks to export as stems.");
      return;
    }
    setIsDownloading(true);
    toast.info(`Exporting ${audioTracks.length} stems...`);
    try {
      for (const track of audioTracks) {
        const blob = await renderMixToWav([track]);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${track.name.replace(/[^a-z0-9]/gi, '_')}_stem.wav`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      }
      sounds.success();
      toast.success(`${audioTracks.length} stems exported!`);
    } catch (e) {
      console.error("Stem export failed", e);
      toast.error("Failed to export stems.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (roomId && projectLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#0D0B14] text-foreground">
      <div className="text-center" aria-live="polite">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading Studio project…</p>
      </div>
    </div>
  );

  if (roomId && projectLoadError) return (
    <div className="flex h-screen items-center justify-center bg-[#0D0B14] px-6 text-foreground">
      <div className="max-w-sm text-center" role="alert">
        <h2 className="font-heading text-xl font-bold">Studio project unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't load this shared project, so the app won't open a blank session in its place.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => setProjectLoadRetryKey((key) => key + 1)}>
            Retry
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")}>
            Leave Studio
          </Button>
        </div>
      </div>
    </div>
  );

  if (showWelcome) return (
    <>
      <StudioWelcome hasAutosave={hasAutosave} handleStartBlank={handleStartBlank} handleLoadAutosave={handleLoadAutosave} handleLoadDemo={handleLoadDemo} navigate={navigate} />
      <StudioVideoHelp />
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-[#0D0B14] text-foreground overflow-hidden relative">
      <StudioVideoHelp />
      {/* Ambient stage glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-[32rem] h-[32rem] rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Performance warning for low-end devices */}
      {isLowEnd && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs font-medium backdrop-blur-md whitespace-nowrap">
          ⚠ Performance Mode: Reduced waveform quality for smoother experience
        </div>
      )}

      {/* Top Toolbar */}
      <div className="min-h-[4rem] py-2 mx-2 sm:mx-3 mt-2 sm:mt-3 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-2 pl-2 sm:pl-4 pr-2 shrink-0 relative z-10">
        <div className="flex items-center gap-4 shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={async () => { if (await handleSave()) navigate('/'); }} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Exit Studio</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="font-heading font-black text-base sm:text-xl tracking-tight flex items-center gap-2">
            <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span className="text-gradient-animate hidden xs:inline sm:inline">NaliStudio</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 border-l border-border/50 text-sm group">
            <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} onFocus={(e) => e.target.select()} className="bg-transparent border-none focus:outline-none focus:ring-0 text-foreground font-medium w-48 truncate placeholder:text-muted-foreground group-hover:bg-secondary/50 rounded px-1 transition-colors" placeholder="Project Name..." />
            <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-1 sm:gap-2 bg-background/50 p-1 sm:p-1.5 rounded-xl border border-border/50 shadow-inner shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Return to Zero (Home)" aria-label="Return to Zero (Home)" aria-keyshortcuts="Home" onClick={(e) => { updateCurrentTime(0); e.currentTarget.blur(); }} className="hidden sm:flex w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><Rewind className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Return to Zero <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Home</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Stop" aria-label="Stop" onClick={(e) => { stop(); e.currentTarget.blur(); }} className="w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><Square className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Stop <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Numpad 0</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Play/Pause (Space)" aria-label="Play/Pause (Space)" aria-keyshortcuts="Space" onClick={(e) => { togglePlay(); e.currentTarget.blur(); }} className={cn("w-12 h-12 rounded-lg transition-all", isPlaying ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>{isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1 fill-current" />}</Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">{isPlaying ? "Pause" : "Play"} <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Space</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Record (R)" aria-label="Record (R)" aria-keyshortcuts="R" onClick={toggleRecord} className={cn("w-12 h-12 rounded-lg transition-all relative overflow-hidden", isRecording ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-400" : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10")}>{isRecording && <span className="absolute inset-0 bg-red-500/20 animate-ping rounded-lg" />}<Circle className={cn("w-5 h-5", isRecording ? "fill-current" : "fill-current")} /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Record <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">R</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Toggle Loop Region" aria-label="Loop" onClick={(e) => { setLoopActive(!loopActive); e.currentTarget.blur(); }} className={cn("w-10 h-10 rounded-lg transition-all", loopActive ? "bg-blue-500/20 text-blue-500" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}><RefreshCw className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Toggle Loop <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+L</kbd></TooltipContent></Tooltip>
            {selectionStart !== null && selectionEnd !== null && (
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Capture Selection as Loop" aria-label="Capture to Loop" onClick={(e) => { setLoopActive(true); e.currentTarget.blur(); }} className="w-10 h-10 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"><Crosshair className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Capture Selection → Loop</TooltipContent></Tooltip>
            )}
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" title="Fast-forward" aria-label="Fast-forward" onClick={(e) => { updateCurrentTime(Math.min(100, currentTimeRef.current + 5)); e.currentTarget.blur(); }} className="hidden sm:flex w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground"><FastForward className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Fast-forward <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">→</kbd></TooltipContent></Tooltip>
           </TooltipProvider>
           <Metronome isPlaying={isPlaying} bpm={bpm} timeSignature={timeSignature} enabled={metronomeEnabled} onToggle={setMetronomeEnabled} />
           </div>

           {/* Pro Tools-style Pre-roll / Post-roll */}
           <PreRollPostRoll preRoll={preRoll} setPreRoll={setPreRoll} postRoll={postRoll} setPostRoll={setPostRoll} />

        {/* Right Tools - Hardware & Export */}
        <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
          {/* Live Collaborators */}
          <LivePresenceBar peers={livePeers} />

          {/* Jam Room */}
          <div className="hidden lg:flex items-center gap-1 mr-2 border-r border-border/50 pr-3">
             <Button variant={jamRoomActive ? "default" : "ghost"} size="sm" onClick={() => setJamRoomActive(!jamRoomActive)} className={cn("gap-2 rounded-xl transition-colors", jamRoomActive ? "bg-primary hover:bg-primary/90 text-primary-foreground border-transparent" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
               <Users className="w-4 h-4" />
               {jamRoomActive ? "Jam Room Active" : "Start Jam Room"}
             </Button>
             {jamRoomActive && (
               <TooltipProvider delayDuration={200}>
                 <Tooltip>
                   <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" title={jamVideoActive ? "Turn Video Off" : "Turn Video On"} onClick={() => setJamVideoActive(!jamVideoActive)} className="w-8 h-8 rounded-lg hover:bg-secondary">
                       {jamVideoActive ? <Video className="w-4 h-4 text-primary" /> : <VideoOff className="w-4 h-4 text-muted-foreground" />}
                     </Button>
                   </TooltipTrigger>
                   <TooltipContent side="bottom" className="text-xs">{jamVideoActive ? "Turn Video Off" : "Turn Video On"}</TooltipContent>
                 </Tooltip>
               </TooltipProvider>
             )}
          </div>

          {/* Quality, Shortcuts & Hardware Config */}
          <div className="hidden lg:flex items-center gap-1 mr-2 border-r border-border/50 pr-3">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                  <Activity className="w-4 h-4" /> Quality
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[280px] bg-card border-border">
                <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-muted-foreground">Audio Quality Settings</div>
                {[
                  { sr: "44.1 kHz", bd: "16-bit", desc: "Standard CD Quality (Low CPU)" },
                  { sr: "44.1 kHz", bd: "24-bit", desc: "Studio Standard (Moderate CPU)" },
                  { sr: "48 kHz", bd: "24-bit", desc: "Video Standard (Moderate CPU)" },
                  { sr: "88.2 kHz", bd: "24-bit", desc: "High Res (High CPU)" },
                  { sr: "96 kHz", bd: "24-bit", desc: "High Res / Video (High CPU)" },
                  { sr: "96 kHz", bd: "32-bit float", desc: "Float High Res (Very High CPU/Storage)" },
                  { sr: "192 kHz", bd: "32-bit float", desc: "Audiophile (Extreme CPU/Storage)" }
                ].map((s, i) => {
                  const isActive = audioSettings.sampleRate === s.sr && audioSettings.bitDepth === s.bd;
                  return (
                    <DropdownMenuItem key={i} onClick={() => setAudioSettings({ ...audioSettings, sampleRate: s.sr, bitDepth: s.bd })} className={cn("cursor-pointer flex-col items-start gap-1 py-1.5", isActive && "bg-primary/10 focus:bg-primary/20")}>
                      <div className="flex items-center justify-between w-full text-xs">
                        <span className={cn(isActive ? "font-bold text-primary" : "font-medium")}>{s.sr} / {s.bd}</span>
                        {isActive && <Check className="w-3 h-3 text-primary" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={() => setShowShortcutsDialog(true)} className={cn("gap-2 rounded-lg transition-colors", showShortcutsDialog ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
              <Keyboard className="w-4 h-4" /> Shortcuts
            </Button>
            <Button variant="ghost" size="sm" title="Hardware Preferences" onClick={() => { stop(); setShowPreferencesDialog(true); }} className="gap-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
              <Settings2 className="w-4 h-4" /> Hardware
            </Button>
          </div>

          {/* Pro Tools-style Big Counter toggle */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setShowBigCounter(!showBigCounter)} className={cn("w-8 h-8 rounded-lg", showBigCounter ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")} title="Big Counter (Ctrl+=)">
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Big Counter <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+=</kbd></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Pro Tools-style transport counter with switchable time formats */}
          <TransportCounter currentTimeRef={currentTimeRef} isRecording={isRecording} bpm={bpm} sampleRate={audioSettings.sampleRate} />
          {/* Sample rate / bit depth badge — Pro Tools shows this prominently in the transport */}
          <div className="hidden md:flex flex-col items-center justify-center px-2 py-1 rounded-lg bg-black/30 border border-border/50 shrink-0" title="Audio Quality">
            <span className="text-[9px] font-mono font-bold text-muted-foreground">{audioSettings.sampleRate}</span>
            <span className="text-[8px] text-muted-foreground/70">{audioSettings.bitDepth}</span>
          </div>


          <div className="flex flex-wrap items-center justify-end gap-2 pl-2 min-w-0">
            <input type="file" ref={fileInputRef} className="hidden" accept="audio/*,.wav,.wave,.mp3,.mid,.midi,.flac,.ogg,.m4a,.aac,.wma,.aiff,.aif" onChange={handleFileChange} />
            <Button id="milestones-btn" onClick={() => setShowMilestones(true)} variant="outline" size="sm" className="gap-2 rounded-xl border-border/50 hover:bg-secondary transition-colors">
              <ListTodo className="w-4 h-4" /> Milestones
            </Button>
            <Button onClick={() => setShowQuickMemo(true)} variant="outline" size="sm" className="gap-2 rounded-xl border-primary/50 text-primary hover:bg-primary/10 transition-colors">
               <Mic className="w-4 h-4" /> Quick Memo
            </Button>
            <Button variant="outline" className="gap-2 rounded-xl border-border/50" onClick={handleImportClick}>
              <Upload className="w-4 h-4" /> Upload Files
            </Button>
            <Button variant="outline" className="gap-2 rounded-xl border-border/50" onClick={handleSave}>
              <Save className="w-4 h-4" /> Save
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild><Button className="gap-2 rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 glow-primary"><Download className="w-4 h-4" /> Export</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setExportFormat('wav'); setExportDialogOpen(true); }} className="cursor-pointer py-2"><Download className="w-4 h-4 mr-2" /> Download Mix (WAV)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setExportFormat('mp3'); setExportDialogOpen(true); }} className="cursor-pointer py-2"><Download className="w-4 h-4 mr-2" /> Download Mix (MP3)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportStems()} className="cursor-pointer py-2"><Layers className="w-4 h-4 mr-2" /> Export Stems (Each Track)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleConsolidateClips} className="cursor-pointer py-2"><Layers className="w-4 h-4 mr-2" /> Consolidate Clips <kbd className="ml-auto bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+K</kbd></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { if (selectedTrackIds.length > 0) setShowAudioSuite(true); else toast.error("Select a track first"); }} className="cursor-pointer py-2"><Wand2 className="w-4 h-4 mr-2" /> AudioSuite (Offline FX) <kbd className="ml-auto bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+U</kbd></DropdownMenuItem>
                <DropdownMenuItem onClick={() => { if (selectedTrackIds.length > 0) setShowFadePresets(true); else toast.error("Select clips first"); }} className="cursor-pointer py-2"><SlidersHorizontal className="w-4 h-4 mr-2" /> Fade Presets <kbd className="ml-auto bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+Shift+F</kbd></DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (!canEditProject) return toast.error("Viewer access cannot publish this shared project.");
                  setBounceRedirect('explore');
                  setBounceOpen(true);
                }} className="cursor-pointer py-2"><Download className="w-4 h-4 mr-2" /> Export & Publish</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (!canEditProject) return toast.error("Viewer access cannot publish this shared project.");
                  setBounceRedirect('cover-art');
                  setBounceOpen(true);
                }} className="cursor-pointer py-2"><ImageIcon className="w-4 h-4 mr-2" /> Export to Cover Creator</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <BounceDialog
              open={bounceOpen}
              onOpenChange={setBounceOpen}
              projectTitle={projectName}
              project={{ id: roomId, genre: "", bpm }}
              canPublish={canEditProject}
              tracks={tracks}
              redirectAfter={bounceRedirect}
              mixOptions={{ masterVolume, masterFx }}
            />
            <div className="border-l border-border/50 h-6 mx-1"></div>
            <button
              onClick={() => window.dispatchEvent(new Event('open-ai-assistant'))}
              title="NALI.ai Assistant"
              className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-white bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <AudioLines className="w-4 h-4 animate-pulse" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar 2 (Tools) */}
      <StudioToolbar2
        addTrack={addTrack} addVcaTrack={addVcaTrack} addFolderTrack={addFolderTrack} selectedTrackIds={selectedTrackIds} tracks={tracks}
        handleSeparateStems={handleSeparateStems} isProcessing={isProcessing} handleGenerateMelody={handleGenerateMelody}
        undo={undo} redo={redo} historyIndex={historyIndex} historyLength={historyRef.current.length}
        bpm={bpm} setBpm={setBpm} bpmInput={bpmInput} setBpmInput={setBpmInput} timeSignature={timeSignature} setTimeSignature={setTimeSignature}
        songKey={songKey} setSongKey={setSongKey}
        editMode={editMode} setEditMode={setEditMode} activeTool={activeTool} setActiveTool={setActiveTool}
        toggleTrackProperty={toggleTrackProperty} splitSelectedTracks={splitSelectedTracks} duplicateSelectedTracks={duplicateSelectedTracks}
        deleteSelectedTracks={deleteSelectedTracks} zoom={zoom} setZoom={setZoom}
        gridSize={gridSize} setGridSize={setGridSize}
      />
      {/* setEditingTrack prop removed — Wave Editor was merged into this inline timeline */}

      {/* Markers Bar — Pro Tools-style memory locations */}
      <MarkersBar
        projectId={roomId || 'local_studio'}
        currentTime={currentTimeRef.current}
        onSeek={updateCurrentTime}
        zoom={zoom}
      />

      {/* Main Workspace */}
      <div className="flex-1 overflow-auto bg-black/40 backdrop-blur-sm relative z-10 mx-2 sm:mx-3 rounded-2xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        {/* Jam Room Floating Overlay */}
        <JamRoomOverlay jamRoomActive={jamRoomActive} defaultRole={defaultRole} setDefaultRole={setDefaultRole} roomId={roomId} />
        {/* Unified scroll — left pane + waveforms move together in one container */}
        <div className="flex w-fit min-w-full min-h-full">
        {/* Track Headers (Left Sidebar) */}
        <div className="w-44 sm:w-72 md:w-96 border-r border-white/10 bg-white/[0.03] backdrop-blur-md flex flex-col sticky left-0 z-10 shrink-0 rounded-l-2xl">
          {/* Spacer matching the timeline ruler — sticky so it stays aligned at top */}
          <div className="h-8 shrink-0 sticky top-0 z-20 border-b border-white/10 bg-[#12101C]/80 backdrop-blur-md" />
          <DragDropContext onDragEnd={handleReorderTracks}>
            <Droppable droppableId="studio-track-headers">
              {(dropProvided) => (
                <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                  {tracks.map((track, index) => {
                    // Skip tracks hidden by a collapsed folder
                    const parentFolder = tracks.find(t => t.trackType === 'folder' && (t.folderMembers || []).includes(track.id) && t.collapsed);
                    if (parentFolder) return null;
                    return (
                    <Draggable key={track.id} draggableId={String(track.id)} index={index} isDragDisabled={isRecording}>
                      {(dragProvided, dragSnapshot) => (
                        track.trackType === 'vca' ? (
                          <VcaTrackHeader track={track} index={index} isRecording={isRecording} selectedTrackIds={selectedTrackIds} dragProvided={dragProvided} dragSnapshot={dragSnapshot} handleTrackClick={handleTrackClick} setTracksWithHistory={setTracksWithHistory} pushToHistory={pushToHistory} tracksRef={tracksRef} setRenamingTrack={setRenamingTrack} setNewTrackName={setNewTrackName} duplicateTrack={duplicateTrack} deleteTrack={deleteTrack} allTracks={tracks} />
                        ) : track.trackType === 'folder' ? (
                          <FolderTrackHeader track={track} index={index} isRecording={isRecording} selectedTrackIds={selectedTrackIds} dragProvided={dragProvided} dragSnapshot={dragSnapshot} handleTrackClick={handleTrackClick} setTracksWithHistory={setTracksWithHistory} pushToHistory={pushToHistory} tracksRef={tracksRef} setRenamingTrack={setRenamingTrack} setNewTrackName={setNewTrackName} duplicateTrack={duplicateTrack} deleteTrack={deleteTrack} allTracks={tracks} toggleFolderCollapse={toggleFolderCollapse} />
                        ) : (
                          <TrackHeader
                            track={track}
                            index={index}
                            isRecording={isRecording}
                            selectedTrackIds={selectedTrackIds}
                            dragProvided={dragProvided}
                            dragSnapshot={dragSnapshot}
                            handleTrackClick={handleTrackClick}
                            setTracksWithHistory={setTracksWithHistory}
                            toggleTrackProperty={toggleTrackProperty}
                            toggleMute={toggleMute}
                            toggleSolo={toggleSolo}
                            toggleArm={toggleArm}
                            updateVolume={updateVolume}
                            pushToHistory={pushToHistory}
                            tracksRef={tracksRef}
                            setRenamingTrack={setRenamingTrack}
                            setNewTrackName={setNewTrackName}
                            handleHealSplit={handleHealSplit}
                            handleRepeatClip={handleRepeatClip}
                            handleToggleGroup={handleToggleGroup}
                            duplicateTrack={duplicateTrack}
                            deleteTrack={deleteTrack}
                            setSelectedTrackIds={setSelectedTrackIds}
                            setShowBeatDetective={setShowBeatDetective}
                            setShowCommitDialog={setShowCommitDialog}
                            setShowAudioSuite={setShowAudioSuite}
                            setShowFadePresets={setShowFadePresets}
                          />
                        )
                      )}
                    </Draggable>
                    );
                  })}
                  {dropProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          {/* Empty space filler */}
          <div className="flex-1 bg-card/20 min-h-[100px]" />
        </div>

        {/* Timeline & Waveforms (Right Area) */}
        <div className="flex-1 relative flex flex-col bg-gradient-to-b from-[#12101C]/80 to-[#0B0912]/90 rounded-r-2xl">
          {/* Timeline Header */}
          <div className="h-8 shrink-0 border-b border-white/10 bg-white/[0.04] backdrop-blur-md sticky top-0 z-20 flex items-end px-0 overflow-hidden timeline-ruler">
            {(() => { const projectEnd = Math.max(...tracks.map(t => (t.startTime || 0) + (t.duration || 0)), 20); return <div className="absolute top-0 bottom-0 w-[2px] bg-red-500/50 z-10 pointer-events-none" style={{ left: `${projectEnd * 20 * zoom}px` }}><div className="absolute top-0 -translate-x-1/2 bg-red-500/80 text-white text-[8px] px-1 rounded-b shadow-md font-bold">END</div></div>; })()}
            <div className="h-full relative cursor-pointer select-none" style={{ width: `${2000 * zoom}px`, minWidth: `${2000 * zoom}px` }}
              onPointerDown={(e) => {
                const target = e.currentTarget;
                const updatePosition = (cX, cY) => { const t = Math.max(0, (cX - target.getBoundingClientRect().left) / (20 * zoom)); updateCurrentTime(t); showEditTooltip(cX, cY, t); };
                updatePosition(e.clientX, e.clientY);
                const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
                const handleUp = () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); hideEditTooltip(); };
                window.addEventListener('pointermove', handleMove); window.addEventListener('pointerup', handleUp);
              }}
            >
              {loopActive && (() => {
                const loopStart = (selectionStart !== null && selectionEnd !== null) ? selectionStart : 0;
                const loopEnd = (selectionStart !== null && selectionEnd !== null) ? selectionEnd : (60/bpm) * parseInt(timeSignature.split('/')[0]||4) * 4;
                return (
                <div className="absolute bottom-0 h-full bg-blue-500/10 border-x-2 border-blue-500 pointer-events-none z-10" style={{ left: `${loopStart * 20 * zoom}px`, width: `${(loopEnd - loopStart) * 20 * zoom}px` }}>
                  <div className="absolute top-0 left-0 bg-blue-500 text-white text-[8px] px-1 rounded-br font-bold shadow-md">LOOP START</div>
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-[8px] px-1 rounded-bl font-bold shadow-md">LOOP END</div>
                </div>
                );
              })()}
              {Array.from({ length: Math.max(1000, Math.ceil(2000/(60/bpm))) }).slice(0, 2000).map((_, i) => {
                const beatsPerBar = parseInt(timeSignature.split('/')[0]) || 4;
                const secondsPerBeat = 60 / bpm;
                const position = i * secondsPerBeat * 20 * zoom;
                const barNumber = Math.floor(i / beatsPerBar) + 1;
                const beatNumber = (i % beatsPerBar) + 1;
                const isBar = beatNumber === 1;
                const showBeats = zoom > 1.5;
                
                if (!isBar && !showBeats) return null;

                return (
                  <div 
                    key={i} 
                    className={cn("absolute bottom-0 text-[10px] text-muted-foreground border-l border-border/60 pl-1", isBar ? "h-4 font-semibold" : "h-2")} 
                    style={{ left: `${position}px` }}
                  >
                    {isBar ? barNumber : (showBeats && zoom > 3 ? `${barNumber}.${beatNumber}` : '')}
                  </div>
                );
              })}
              
              <div ref={headerPlayheadRef} className="absolute top-0 bottom-0 w-[2px] -ml-[1px] bg-primary z-50 pointer-events-none" style={{ left: `${currentTimeRef.current * 20 * zoom}px` }}>
                <div className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-primary rounded-b-sm flex items-center justify-center shadow-md" />
              </div>
            </div>
          </div>

          {/* Tracks Area */}
          <div style={{ width: `${2000 * zoom}px`, minWidth: `${2000 * zoom}px` }}>
            <div 
              className="relative w-full min-h-full cursor-text select-none" 
              onPointerDown={(e) => {
              if (e.target.closest('.audio-clip')) return;
              const target = e.currentTarget;
              const updatePosition = (clientX) => {
                const rect = target.getBoundingClientRect();
                const x = clientX - rect.left;
                updateCurrentTime(Math.max(0, x / (20 * zoom)));
              };
              updatePosition(e.clientX);
              
              const handleMove = (moveEvent) => updatePosition(moveEvent.clientX);
              const handleUp = () => {
                window.removeEventListener('pointermove', handleMove);
                window.removeEventListener('pointerup', handleUp);
              };
              window.addEventListener('pointermove', handleMove);
              window.addEventListener('pointerup', handleUp);
            }}
          >
            {loopActive && (() => {
              const loopStart = (selectionStart !== null && selectionEnd !== null) ? selectionStart : 0;
              const loopEnd = (selectionStart !== null && selectionEnd !== null) ? selectionEnd : (60/bpm) * parseInt(timeSignature.split('/')[0]||4) * 4;
              return <div className="absolute top-0 bottom-0 bg-blue-500/10 border-x border-blue-500/50 pointer-events-none z-10" style={{ left: `${loopStart * 20 * zoom}px`, width: `${(loopEnd - loopStart) * 20 * zoom}px` }} />;
            })()}
            {/* Pro Tools-style selection region (in/out points) */}
            <SelectionRegion selectionStart={selectionStart} selectionEnd={selectionEnd} zoom={zoom} />
            {(() => { const projectEnd = Math.max(...tracks.map(t => (t.startTime || 0) + (t.duration || 0)), 20); return <div className="absolute top-0 bottom-0 w-[1px] bg-red-500/30 border-r border-red-500/10 pointer-events-none z-0" style={{ left: `${projectEnd * 20 * zoom}px` }} />; })()}
            {/* Waveform Rows */}
            <div className="flex flex-col">
              {tracks.filter(t => !t.hidden && !(tracks.find(f => f.trackType === 'folder' && (f.folderMembers || []).includes(t.id) && f.collapsed))).map((track) => (
                <div
                  key={track.id}
                  onClick={(e) => handleTrackClick(e, track.id)}
                  style={{ height: track.trackType === 'vca' ? '96px' : track.trackType === 'folder' ? '48px' : (track.height ? `${track.height}px` : (track.showAutomation ? '176px' : '112px')), flexShrink: 0 }}
                  className={cn(
                    "border-b border-border/20 relative group transition-none shrink-0",
                    track.muted ? "opacity-30" : "",
                    selectedTrackIds.includes(track.id) ? "bg-primary/15 shadow-[inset_0_0_30px_hsl(var(--primary)/0.1)]" : "",
                    tracks.some(t => t.solo) && !track.solo && "opacity-40 grayscale"
                  )}
                >
                  {/* Grid lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px)] opacity-30 pointer-events-none z-0" style={{ backgroundSize: `${(60 / bpm) * parseInt(timeSignature.split('/')[0] || 4) * 20 * zoom}px 100%` }} />
                  
                  {/* Pro Tools-style Crossfade overlay between adjacent clips on this track */}
                  <CrossfadeOverlay clips={tracks.filter(t => t.id === track.id || (t.splitFrom === track.id))} zoom={zoom} trackId={track.id} />

                  {/* Pro Tools-style Volume Automation Lane */}
                  {track.showAutomation && (
                    <AutomationLane
                      track={track}
                      zoom={zoom}
                      onPointsChange={(newPoints, mode) => setTracks(prev => prev.map(t => {
                        if (t.id !== track.id) return t;
                        if (mode === 'pan') return { ...t, panAutomationPoints: newPoints, automationMode: 'pan' };
                        if (mode === 'volume') return { ...t, automationPoints: newPoints, automationMode: 'volume' };
                        return t;
                      }))}
                      onCommit={() => pushToHistory(tracksRef.current)}
                    />
                  )}

                  {/* Armed / Recording Indicator */}
                  {track.armed && (
                    <div 
                      ref={el => { recordingIndicatorRefs.current[track.id] = el; }}
                      className={cn(
                        "absolute top-0 bottom-0 z-20 pointer-events-none transition-all overflow-hidden",
                        isRecording ? "border-l-2 border-red-500 bg-red-500/10" : "w-[2px] bg-red-500/50"
                      )}
                      style={{ 
                        left: `${(isRecording && recordingStartTime !== null ? recordingStartTime : currentTimeRef.current) * 20 * zoom}px`,
                        width: isRecording && recordingStartTime !== null ? `${Math.max(0, currentTimeRef.current - recordingStartTime) * 20 * zoom}px` : '2px'
                      }}
                    >
                      {isRecording && (
                        <canvas 
                          ref={el => { recordingCanvasRefs.current[track.id] = el; }} 
                          className="absolute top-0 bottom-0 left-0 h-full" 
                          width={20000}
                          height={200} 
                        />
                      )}
                      <div className={cn(
                        "absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap flex items-center gap-1",
                        isRecording ? "bg-red-500 animate-pulse" : "bg-red-500/80"
                      )}>
                        <Circle className={cn("w-2 h-2", isRecording ? "fill-current" : "")} />
                        {isRecording ? "RECORDING" : "REC START"}
                      </div>
                      {!isRecording && (
                        <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-red-500/20 to-transparent border-y border-l border-red-500/30 rounded-l-md" />
                      )}
                    </div>
                  )}
                  
                  {/* Empty track placeholder — clarifies the track exists but has no audio yet */}
                  {(!track.waveform || track.waveform.length === 0) && !track.armed && track.trackType !== 'vca' && track.trackType !== 'folder' && (
                    track.instrument ? (
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 z-20">
                        <div className="flex items-center gap-2 text-[11px]">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isProcessing === 'instrument'}
                            onClick={(e) => { e.stopPropagation(); renderInstrumentTrack(track.id); }}
                            className="h-7 gap-1.5 text-[11px] border-primary/40 text-primary hover:bg-primary/10"
                          >
                            {isProcessing === 'instrument'
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Wand2 className="w-3.5 h-3.5" />}
                            Render {getInstrument(track.instrument).name}
                          </Button>
                          <span className="text-muted-foreground/60 italic hidden sm:inline">
                            in {songKey} at {bpm} BPM
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 italic">
                          <Mic className="w-3.5 h-3.5 shrink-0" />
                          <span>Empty — upload a file or record to fill this track</span>
                        </div>
                      </div>
                    )
                  )}
                  {/* VCA Master lane label */}
                  {track.trackType === 'vca' && (
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
                      <div className="flex items-center gap-2 text-[11px] text-accent/70 italic">
                        <Volume2 className="w-3.5 h-3.5 shrink-0" />
                        <span>VCA Master — assign member tracks from the header</span>
                      </div>
                    </div>
                  )}
                  {/* Folder lane label */}
                  {track.trackType === 'folder' && (
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
                      <div className="flex items-center gap-2 text-[11px] text-primary/70 italic">
                        <Folder className="w-3.5 h-3.5 shrink-0" />
                        <span>Folder — assign member tracks from the header</span>
                      </div>
                    </div>
                  )}

                  {/* Audio Region (Clip) */}
                  {track.waveform && track.waveform.length > 0 && (
                    <div 
                      onPointerMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isTopHalf = (e.clientY - rect.top) < rect.height / 2;
                        if (activeTool === 'smart') {
                           e.currentTarget.style.cursor = isTopHalf ? 'text' : 'grab';
                         } else if (activeTool === 'grab') {
                           e.currentTarget.style.cursor = 'grab';
                         } else if (activeTool === 'cut') {
                           e.currentTarget.style.cursor = 'crosshair';
                         } else if (activeTool === 'scrub') {
                           e.currentTarget.style.cursor = 'ew-resize';
                         } else {
                           e.currentTarget.style.cursor = 'default';
                         }
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (track.locked || activeTool === 'fade') return;

                        // Spot mode: open dialog to type exact timecode position
                        if (editMode === 'spot') {
                          setSpotClip(track);
                          setSpotDialogOpen(true);
                          return;
                        }

                        const rect = e.currentTarget.getBoundingClientRect();
                        const isTopHalf = (e.clientY - rect.top) < rect.height / 2;

                        if (activeTool === 'cut') {
                           // Cut removes the audio after the click point (unlike Split, which
                           // keeps both halves as separate clips) — the clip is simply shortened.
                           const target = e.currentTarget;
                           const rect = target.getBoundingClientRect();
                           const clickX = e.clientX - rect.left;
                           const clickRatio = clickX / rect.width;
                           
                           const newDuration = track.duration * clickRatio;
                           
                           setTracksWithHistory(prev => prev.map(t => t.id === track.id ? {
                             ...t,
                             duration: newDuration,
                             fullDuration: t.fullDuration || t.duration,
                             clipStart: t.clipStart || 0
                           } : t));
                           toast.success("Audio after the cut point removed");
                           return;
                        }

                        if (activeTool === 'scrub') {
                           // Pro Tools scrub: play a short snippet at the click/drag position
                           const target = e.currentTarget;
                           const rect = target.getBoundingClientRect();
                           const playScrub = (clientX) => {
                             const clickX = clientX - rect.left;
                             const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
                             const newTime = (track.startTime || 0) + ((track.duration || 40) * clickRatio);
                             updateCurrentTime(newTime);
                             // Play a short snippet from this position
                             if (track.audioUrl) {
                               const audio = getTrackAudio(track);
                               if (!audio) return;
                               const offset = (track.clipStart || 0) + ((track.duration || 40) * clickRatio);
                               audio.currentTime = Math.max(0, Math.min(offset, (track.fullDuration || track.duration || 40) - 0.1));
                               audio.play().then(() => {
                                 setTimeout(() => audio.pause(), 150);
                               }).catch(() => {});
                             }
                           };
                           playScrub(e.clientX);
                           target.setPointerCapture(e.pointerId);
                           const handleMove = (moveEvent) => playScrub(moveEvent.clientX);
                           const handleUp = (upEvent) => {
                             target.releasePointerCapture(upEvent.pointerId);
                             target.removeEventListener('pointermove', handleMove);
                             target.removeEventListener('pointerup', handleUp);
                             Object.values(audioElementsRef.current).forEach(a => a.pause());
                           };
                           target.addEventListener('pointermove', handleMove);
                           target.addEventListener('pointerup', handleUp);
                           return;
                        }

                        if (activeTool === 'smart' && isTopHalf) {
                          const clickX = e.clientX - rect.left;
                          const clickRatio = clickX / rect.width;
                          const newTime = (track.startTime || 0) + ((track.duration || 40) * clickRatio);
                          updateCurrentTime(newTime);
                          return;
                        }

                        if (activeTool === 'grab' || (activeTool === 'smart' && !isTopHalf)) {
                          const target = e.currentTarget;
                          const startX = e.clientX;
                          const initialStartTime = track.startTime !== undefined ? track.startTime : 0;
                          target.setPointerCapture(e.pointerId);
                          let hasDragged = false;
                          
                          const handleMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            if (!hasDragged) {
                              if (Math.abs(deltaX) < 3) return; // Ignore tiny movement so a plain click doesn't highlight the clip
                              hasDragged = true;
                              Object.assign(target.style, { zIndex: '50', opacity: '0.9', filter: 'brightness(1.2)', boxShadow: '0 0 20px hsl(var(--primary)/0.5), inset 0 0 0 2px hsl(var(--primary))' });
                            }
                            const deltaTime = deltaX / (20 * zoom);
                            let newStartTime = Math.max(0, initialStartTime + deltaTime);
                            if (editMode === 'grid') newStartTime = Math.round(newStartTime / gridSize) * gridSize;
                            target.style.left = `${newStartTime * 20 * zoom}px`;
                            target.dataset.newStartTime = newStartTime;
                            showEditTooltip(moveEvent.clientX, moveEvent.clientY, newStartTime);
                          };
                          
                          const handleUp = (upEvent) => {
                            Object.assign(target.style, { zIndex: '', opacity: '', filter: '', boxShadow: '' });
                            target.releasePointerCapture(upEvent.pointerId);
                            target.removeEventListener('pointermove', handleMove);
                            target.removeEventListener('pointerup', handleUp);
                            hideEditTooltip();
                            if (target.dataset.newStartTime !== undefined) {
                              const newStartTime = parseFloat(target.dataset.newStartTime);
                              setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, startTime: newStartTime } : t));
                              delete target.dataset.newStartTime;
                            }
                          };
                          
                          target.addEventListener('pointermove', handleMove);
                          target.addEventListener('pointerup', handleUp);
                        }
                      }}
                      className="audio-clip absolute top-2 bottom-2 rounded-r-lg border border-white/10 bg-card/60 backdrop-blur overflow-hidden group-hover:border-white/30 transition-colors shadow-sm"
                      style={{ 
                        left: `${(track.startTime !== undefined ? track.startTime : 0) * 20 * zoom}px`,
                        width: `${(track.duration !== undefined ? track.duration : 40) * 20 * zoom}px`
                      }}
                    >
                      {/* Left Trim Handle */}
                      <div 
                        className={cn("absolute left-0 w-4 z-20 group/handle flex justify-start items-center bg-black/20", 
                          (activeTool === 'trim' || activeTool === 'smart') ? "cursor-col-resize hover:bg-white/40" : "pointer-events-none opacity-0",
                          activeTool === 'smart' ? "top-[50%] bottom-0" : "top-0 bottom-0"
                        )}
                        onPointerDown={(e) => {
                          if (activeTool !== 'trim' && activeTool !== 'smart') return;
                          e.stopPropagation();
                          const target = e.currentTarget;
                          const startX = e.clientX;
                          const initialStartTime = track.startTime !== undefined ? track.startTime : 0;
                          const initialDuration = track.duration !== undefined ? track.duration : 40;
                          const initialClipStart = track.clipStart || 0;
                          
                          target.setPointerCapture(e.pointerId);
                          
                          const MIN_CLIP_DURATION = 0.001; // 1ms — surgical-precision trim floor
                          const round = (v) => Math.round(v * 1000) / 1000; // snap to 1ms to avoid float drift
                          const handleMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaTime = round(deltaX / (20 * zoom));
                            
                            if (deltaTime < initialDuration - MIN_CLIP_DURATION) { 
                               // Don't allow left trim to go before the actual start of the audio file
                               const maxLeftTrim = -initialClipStart;
                               const trimAmount = Math.max(maxLeftTrim, deltaTime);
                               
                               setTracks(prev => prev.map(t => 
                                t.id === track.id ? { 
                                  ...t, 
                                  startTime: round(initialStartTime + trimAmount),
                                  duration: round(initialDuration - trimAmount),
                                  clipStart: round(initialClipStart + trimAmount)
                                  } : t
                                  ));
                                  showEditTooltip(moveEvent.clientX, moveEvent.clientY, initialStartTime + trimAmount);
                                  }
                                  };

                                  const handleUp = (upEvent) => {
                                  target.releasePointerCapture(upEvent.pointerId);
                                  target.removeEventListener('pointermove', handleMove);
                                  target.removeEventListener('pointerup', handleUp);
                                  pushToHistory(tracksRef.current);
                                  hideEditTooltip();
                                  };

                                  target.addEventListener('pointermove', handleMove);
                                  target.addEventListener('pointerup', handleUp);
                                            }}
                                          >
                                            <div className="w-1 h-4 bg-white/50 group-hover/handle:bg-white rounded-full" />
                                          </div>

                                          {/* Right Trim Handle */}
                      <div 
                        className={cn("absolute right-0 w-4 z-20 group/handle flex justify-end items-center bg-black/20", 
                          (activeTool === 'trim' || activeTool === 'smart') ? "cursor-col-resize hover:bg-white/40" : "pointer-events-none opacity-0",
                          activeTool === 'smart' ? "top-[50%] bottom-0" : "top-0 bottom-0"
                        )}
                        onPointerDown={(e) => {
                          if (activeTool !== 'trim' && activeTool !== 'smart') return;
                          e.stopPropagation();
                          const target = e.currentTarget;
                          const startX = e.clientX;
                          const initialDuration = track.duration !== undefined ? track.duration : 40;
                          const initialClipStart = track.clipStart || 0;
                          const fullDuration = track.fullDuration || track.duration || 40;
                          
                          target.setPointerCapture(e.pointerId);
                          
                          const MIN_CLIP_DURATION_R = 0.001; // 1ms — surgical-precision trim floor
                          const roundR = (v) => Math.round(v * 1000) / 1000; // snap to 1ms to avoid float drift
                          const handleMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaTime = roundR(deltaX / (20 * zoom));
                            
                            if (-deltaTime < initialDuration - MIN_CLIP_DURATION_R) {
                               // Allow dragging right to restore the audio, up to its full duration
                               const maxRightTrim = fullDuration - (initialClipStart + initialDuration);
                               const trimAmount = Math.max(-maxRightTrim, -deltaTime); 
                               
                               setTracks(prev => prev.map(t => 
                                t.id === track.id ? { 
                                  ...t, 
                                  duration: roundR(initialDuration - trimAmount)
                                  } : t
                                  ));
                                  showEditTooltip(moveEvent.clientX, moveEvent.clientY, (track.startTime || 0) + (initialDuration - trimAmount));
                                  }
                                  };

                                  const handleUp = (upEvent) => {
                                  target.releasePointerCapture(upEvent.pointerId);
                                  target.removeEventListener('pointermove', handleMove);
                                  target.removeEventListener('pointerup', handleUp);
                                  pushToHistory(tracksRef.current);
                                  hideEditTooltip();
                                  };
                          
                          target.addEventListener('pointermove', handleMove);
                          target.addEventListener('pointerup', handleUp);
                        }}
                      >
                        <div className="w-1 h-4 bg-white/50 group-hover/handle:bg-white rounded-full" />
                      </div>

                      <div className="absolute top-1 left-4 text-[10px] font-medium text-white/50 pointer-events-none flex items-center gap-1 truncate max-w-[90%]">
                        {track.name} - Take 1
                        {track.locked && <Link2 className="w-3 h-3 text-red-400" />}
                        {track.elasticAudio && <Activity className="w-3 h-3 text-blue-400" />}
                      </div>
                      
                      {/* Fade In/Out Overlays & Handles */}
                      <div 
                        className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none"
                        style={{ width: `${(track.fadeIn || 0) * 100}%` }}
                      />
                      {(activeTool === 'fade' || activeTool === 'smart') && (
                        <div className={cn("absolute w-6 hover:bg-white/10 flex justify-center group z-20 pointer-events-auto",
                            activeTool === 'smart' ? "top-0 bottom-[50%] items-start cursor-crosshair" : "top-0 bottom-0 items-center cursor-ew-resize"
                          )}
                          style={{ left: `calc(${(track.fadeIn || 0) * 100}% - 12px)` }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const target = e.currentTarget;
                            const container = target.parentElement;
                            const rect = container.getBoundingClientRect();
                            target.setPointerCapture(e.pointerId);
                            
                            const handleMove = (moveEvent) => {
                              const currentX = Math.max(0, Math.min(1 - (track.fadeOut || 0), (moveEvent.clientX - rect.left) / rect.width));
                              target.style.left = `calc(${currentX * 100}% - 12px)`;
                              if (target.previousElementSibling) {
                                target.previousElementSibling.style.width = `${currentX * 100}%`;
                              }
                              target.dataset.newFade = currentX;
                            };
                            
                            const handleUp = (upEvent) => {
                              target.releasePointerCapture(upEvent.pointerId);
                              target.removeEventListener('pointermove', handleMove);
                              target.removeEventListener('pointerup', handleUp);
                              const newFadeStr = target.dataset.newFade;
                              if (newFadeStr !== undefined) {
                                setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, fadeIn: parseFloat(newFadeStr) } : t));
                                delete target.dataset.newFade;
                              }
                            };
                            
                            target.addEventListener('pointermove', handleMove);
                            target.addEventListener('pointerup', handleUp);
                          }}
                        >
                          <div className={cn("bg-white/50 group-hover:bg-white transition-colors shadow-sm",
                            activeTool === 'smart' ? "w-2 h-2 mt-1 rounded-sm border border-black/50" : "w-1 h-6 rounded-full"
                          )} />
                        </div>
                      )}

                      <div className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" style={{ width: `${(track.fadeOut || 0) * 100}%` }} />
                      {(activeTool === 'fade' || activeTool === 'smart') && (
                        <div className={cn("absolute w-6 hover:bg-white/10 flex justify-center group z-20 pointer-events-auto", activeTool === 'smart' ? "top-0 bottom-[50%] items-start cursor-crosshair" : "top-0 bottom-0 items-center cursor-ew-resize")}
                          style={{ right: `calc(${(track.fadeOut || 0) * 100}% - 12px)` }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const target = e.currentTarget;
                            const container = target.parentElement;
                            const rect = container.getBoundingClientRect();
                            target.setPointerCapture(e.pointerId);
                            const handleMove = (moveEvent) => {
                              const currentX = Math.max(0, Math.min(1 - (track.fadeIn || 0), 1 - ((moveEvent.clientX - rect.left) / rect.width)));
                              target.style.right = `calc(${currentX * 100}% - 12px)`;
                              if (target.previousElementSibling) target.previousElementSibling.style.width = `${currentX * 100}%`;
                              target.dataset.newFade = currentX;
                            };
                            const handleUp = (upEvent) => {
                              target.releasePointerCapture(upEvent.pointerId);
                              target.removeEventListener('pointermove', handleMove);
                              target.removeEventListener('pointerup', handleUp);
                              if (target.dataset.newFade !== undefined) {
                                setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, fadeOut: parseFloat(target.dataset.newFade) } : t));
                                delete target.dataset.newFade;
                              }
                            };
                            target.addEventListener('pointermove', handleMove);
                            target.addEventListener('pointerup', handleUp);
                          }}
                        >
                          <div className={cn("bg-white/50 group-hover:bg-white transition-colors shadow-sm", activeTool === 'smart' ? "w-2 h-2 mt-1 rounded-sm border border-black/50" : "w-1 h-6 rounded-full")} />
                        </div>
                      )}

                      {/* Pro Tools-style Clip Gain Line — drag to adjust clip gain independently */}
                      <ClipGainLine
                        clipGain={track.clipGain || 0}
                        activeTool={activeTool}
                        onChange={(newGain) => setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, clipGain: newGain } : t))}
                        onCommit={() => pushToHistory(tracksRef.current)}
                      />

                      <div className={cn("absolute overflow-hidden pointer-events-none", track.showAutomation ? "top-6 bottom-16" : "top-4 bottom-2")} style={{ left: 0, right: 0 }}>
                        <div style={{ position: 'absolute', left: `${-(track.clipStart || 0) * 20 * zoom}px`, width: `${(track.fullDuration || track.duration || 40) * 20 * zoom}px`, height: '100%' }}>
                          <TrackWaveformSVG track={track} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Playhead */}
            <div ref={playheadRef} className="absolute top-0 bottom-0 w-[2px] -ml-[1px] bg-primary z-50 pointer-events-none group shadow-[0_0_10px_rgba(var(--primary),0.8)]" style={{ left: `${currentTimeRef.current * 20 * zoom}px` }}>
              <div className="absolute top-0 -translate-x-1/2 w-4 h-4 bg-primary rounded-b flex items-center justify-center cursor-ew-resize pointer-events-auto hover:bg-primary/90 shadow-md"><div className="w-0.5 h-2 bg-background/80 rounded-full" /></div>
            </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Plugin Rack Panel (collapsible, sits between workspace and mixer) */}
      <Suspense fallback={null}>
      <PluginRack
        open={showPluginRack}
        onToggle={() => setShowPluginRack(!showPluginRack)}
        trackName={fxTarget === 'master' ? 'Master Bus' : selectedPluginTrack?.name}
        isMaster={fxTarget === 'master'}
        tracks={tracks}
        plugins={fxTarget === 'master' ? masterFx : selectedPluginTrack?.plugins}
        onPluginsChange={handlePluginsChange}
        onTargetChange={(target) => setFxTarget(target)}
      />
      </Suspense>

      {/* Bottom Mixer / Status Bar */}
      <div className="min-h-[2.5rem] py-1.5 mx-2 sm:mx-3 mb-2 sm:mb-3 mt-2 sm:mt-3 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between px-3 sm:px-4 text-xs text-muted-foreground shrink-0 overflow-hidden gap-2 relative z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => setShowMixerPanel(!showMixerPanel)} className={cn("h-6 text-xs gap-1.5", showMixerPanel && "bg-secondary text-foreground")}>
            <SlidersHorizontal className="w-3 h-3" /> Mixer
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowPluginRack(!showPluginRack)} className={cn("h-6 text-xs gap-1.5 transition-colors", showPluginRack && "bg-secondary text-foreground")}>
            <SlidersHorizontal className="w-3 h-3" /> Plugins
          </Button>
          <div className="hidden md:flex items-center gap-2 border-l border-r border-border/50 px-3 mx-1" title="Master Output Level (Scales all track volumes)">
            <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Master</span>
            <Volume2 className="w-3 h-3 text-muted-foreground" />
            <Slider 
              value={[masterVolume]} 
              max={100} 
              step={1} 
              onValueChange={(val) => setMasterVolume(val[0])}
              className="w-20"
            />
            <span className="w-7 text-right font-mono text-[10px]">{masterVolume}%</span>
          </div>
          <span className="flex items-center gap-1.5 shrink-0"><Layers className="w-3.5 h-3.5" /> {tracks.length} Tracks</span>
          <NudgeValueSelector nudgeValue={nudgeValue} setNudgeValue={setNudgeValue} bpm={bpm} />
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="flex items-center gap-1.5">
            <Circle className={cn("w-2.5 h-2.5", isRecording ? "fill-red-500 text-red-500 animate-pulse" : isPlaying ? "fill-primary text-primary" : "fill-foreground text-foreground")} />
            {isRecording ? "Recording" : isPlaying ? "Playing" : "Stopped"}
          </span>
          <div className="hidden sm:flex items-center gap-3 border-l border-border/50 pl-3">
            <CpuMeter />
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
      <MixerPanel
        show={showMixerPanel}
        onClose={() => setShowMixerPanel(false)}
        tracks={tracks}
        masterVolume={masterVolume}
        setMasterVolume={setMasterVolume}
        updateVolume={updateVolume}
        toggleMute={toggleMute}
        toggleSolo={toggleSolo}
        updateTrack={(trackId, data) => setTracks(prev => prev.map(t => t.id === trackId ? { ...t, ...data } : t))}
        onCommitTrack={() => pushToHistory(tracksRef.current)}
        onOpenFX={openTrackFx}
        onOpenMasterFX={openMasterFx}
        masterFx={masterFx}
        fxTarget={showPluginRack ? fxTarget : null}
        isPlaying={isPlaying}
        currentTimeRef={currentTimeRef}
      />
      </Suspense>

      <HardwarePreferencesDialog 
        open={showPreferencesDialog} 
        onOpenChange={setShowPreferencesDialog} 
        hardware={hardware} 
        audioSettings={audioSettings}
        setAudioSettings={setAudioSettings}
        onRefreshMidi={async () => {
          setHardware(prev => ({...prev, refreshingMidi: true}));
          try {
            if (navigator.requestMIDIAccess) {
              const access = await navigator.requestMIDIAccess({ sysex: false });
              setHardware(prev => ({...prev, midi: access.inputs.size > 0, refreshingMidi: false}));
            } else {
              setHardware(prev => ({...prev, refreshingMidi: false}));
            }
          } catch (e) {
            setHardware(prev => ({...prev, refreshingMidi: false}));
          }
        }}
      />

      <KeyboardShortcutsDialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog} />

      <StudioExtras 
        showQuickMemo={showQuickMemo} setShowQuickMemo={setShowQuickMemo}
        showImportDialog={showImportDialog} setShowImportDialog={setShowImportDialog}
        handleFileChange={(e) => {
          handleFileChange(e);
          setShowImportDialog(false);
        }}
        showMilestones={showMilestones} setShowMilestones={setShowMilestones}
        projectId={roomId || "local_studio"}
      />

      <StudioDialogs
        creatingTrack={creatingTrack} setCreatingTrack={setCreatingTrack}
        newTrackName={newTrackName} setNewTrackName={setNewTrackName}
        newTrackType={newTrackType} setNewTrackType={setNewTrackType}
        newTrackInstrument={newTrackInstrument} setNewTrackInstrument={setNewTrackInstrument}
        newTrackMidiChannel={newTrackMidiChannel} setNewTrackMidiChannel={setNewTrackMidiChannel}
        handleCreateTrackConfirm={handleCreateTrackConfirm}
        renamingTrack={renamingTrack} setRenamingTrack={setRenamingTrack}
        setTracksWithHistory={setTracksWithHistory}
        pendingTimeSignature={pendingTimeSignature} setPendingTimeSignature={setPendingTimeSignature} setTimeSignature={setTimeSignature}
        pendingSongKey={pendingSongKey} setPendingSongKey={setPendingSongKey} setSongKey={setSongKey}
      />

      <ExportPurchaseDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        format={exportFormat}
        tracks={tracks}
        projectName={projectName}
        mixOptions={{ masterVolume, masterFx }}
      />

      {/* Precision editing tooltip — DOM-direct, no re-renders */}
      <div
        ref={editTooltipRef}
        className="fixed z-[200] pointer-events-none bg-primary text-primary-foreground text-xs font-mono px-2 py-1 rounded-md shadow-lg opacity-0 transition-opacity duration-150"
        style={{ top: 0, left: 0 }}
      />

      {/* Pro Tools-style count-in overlay — shows 1-bar count before recording */}
      <CountInIndicator
        active={countInActive}
        beatsPerBar={parseInt(timeSignature.split('/')[0]) || 4}
        bpm={bpm}
        onComplete={handleCountInComplete}
      />

      {/* Pro Tools-style Spot dialog — type exact timecode to position a clip */}
      <SpotDialog
        open={spotDialogOpen}
        onOpenChange={setSpotDialogOpen}
        clip={spotClip}
        bpm={bpm}
        timeSignature={timeSignature}
        onSpot={(timeInSeconds) => {
          if (spotClip) {
            setTracksWithHistory(prev => prev.map(t => t.id === spotClip.id ? { ...t, startTime: Math.max(0, timeInSeconds) } : t));
            toast.success(`Moved "${spotClip.name}" to ${timeInSeconds.toFixed(3)}s`);
            sounds.nav();
          }
        }}
      />

      {/* Pro Tools-style Big Counter overlay */}
      <BigCounter
        open={showBigCounter}
        onToggle={setShowBigCounter}
        currentTimeRef={currentTimeRef}
        isRecording={isRecording}
        bpm={bpm}
        sampleRate={audioSettings.sampleRate}
      />

      {/* Pro Tools-style AudioSuite — offline clip processing */}
      <Suspense fallback={null}>
      <AudioSuiteDialog
        open={showAudioSuite}
        onOpenChange={setShowAudioSuite}
        track={tracks.find(t => selectedTrackIds.includes(t.id))}
        onProcess={({ audioUrl, waveform, duration }) => {
          const track = tracks.find(t => selectedTrackIds.includes(t.id));
          if (!track) return;
          if (track.audioUrl?.startsWith('blob:')) { try { URL.revokeObjectURL(track.audioUrl); } catch (e) {} }
          setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, audioUrl, waveform, duration, fullDuration: duration, clipStart: 0 } : t));
        }}
      />
      </Suspense>

      {/* Pro Tools-style Fade Presets — apply preset fade curves */}
      <FadePresetsDialog
        open={showFadePresets}
        onOpenChange={setShowFadePresets}
        tracks={tracks}
        selectedTrackIds={selectedTrackIds}
        onApply={(fadeIn, fadeOut, preset) => {
          setTracksWithHistory(prev => prev.map(t => selectedTrackIds.includes(t.id) ? { ...t, fadeIn, fadeOut, fadePreset: preset } : t));
          toast.success(`Fade preset applied to ${selectedTrackIds.length} clip${selectedTrackIds.length > 1 ? 's' : ''}`);
        }}
      />

      {/* Pro Tools-style Beat Detective — transient detection + quantize */}
      <Suspense fallback={null}>
      <BeatDetectiveDialog
        open={showBeatDetective}
        onOpenChange={setShowBeatDetective}
        track={tracks.find(t => selectedTrackIds.includes(t.id))}
        bpm={bpm}
        timeSignature={timeSignature}
        gridSize={gridSize}
        onQuantize={(quantizedHits) => {
          const track = tracks.find(t => selectedTrackIds.includes(t.id));
          if (!track) return;
          toast.info(`${quantizedHits.length} hits quantized — markers placed on timeline`);
          quantizedHits.forEach((time, i) => {
            window.dispatchEvent(new CustomEvent('studio-add-marker', { detail: { time, name: `BD ${i + 1}` } }));
          });
        }}
      />
      </Suspense>

      {/* Pro Tools-style Track Commit — render track to audio */}
      <TrackCommitDialog
        open={showCommitDialog}
        onOpenChange={setShowCommitDialog}
        track={tracks.find(t => selectedTrackIds.includes(t.id))}
        onCommit={(newAudioUrl) => {
          const track = tracks.find(t => selectedTrackIds.includes(t.id));
          if (!track) return;
          if (track.audioUrl?.startsWith('blob:')) { try { URL.revokeObjectURL(track.audioUrl); } catch (e) {} }
          // The render bakes fader, pan, inserts and Send 1 into the file — reset them
          // so committed audio isn't processed twice on playback/export.
          setTracksWithHistory(prev => prev.map(t => {
            if (t.id !== track.id) return t;
            const { effects: _effects, ...rest } = t;
            return {
              ...rest,
              audioUrl: newAudioUrl,
              clipGain: 0,
              volume: 100,
              pan: 50,
              send1: 0,
              plugins: {},
              fadeIn: 0,
              fadeOut: 0,
              committed: true,
            };
          }));
        }}
      />

      {/* Mobile bottom bar - Studio only */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex items-center justify-center border-t border-border bg-card/90 backdrop-blur-md py-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          onClick={async () => { if (await handleSave()) navigate('/'); }}
          className="flex items-center gap-2 px-6 py-2 rounded-full bg-secondary text-muted-foreground hover:text-foreground text-sm font-medium transition-colors min-h-[44px]"
        >
          <ChevronLeft className="w-4 h-4" /> Exit Studio
        </button>
      </div>
    </div>
  );
}