import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Film, FolderOpen, Pause, Play, Plus, Save, Scissors, Sparkles, Trash2, Undo2, Redo2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { secureUploadFile } from "@/lib/secureUpload";
import { clamp, clipLength, formatTime, projectLength, splitClip, trimClip } from "@/lib/videoTimeline";
import { removeTransformKeyframe, setTransformKeyframe, transformAt } from "@/lib/videoKeyframes";
import { transitionState } from "@/lib/videoTransitions";

const PROJECT_KEY = "nalibase.videoEditor.v1";
const DB_NAME = "nalibase-video-assets";
const WIDTH = 1280;
const HEIGHT = 720;

function openAssets() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function storeFile(id, file) {
  const db = await openAssets();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function loadFile(id) {
  const db = await openAssets();
  const file = await new Promise((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return file;
}
async function deleteFile(id) {
  const db = await openAssets();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
const metadata = (url, type) => new Promise((resolve, reject) => {
  const element = document.createElement(type === "image" ? "img" : type === "audio" ? "audio" : "video");
  element.preload = "metadata";
  element.onloadedmetadata = () => resolve(Number.isFinite(element.duration) ? element.duration : 5);
  element.onload = () => resolve(5);
  element.onerror = () => reject(new Error("This browser cannot read that media file."));
  element.src = url;
});
const kindOf = (file) => file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : null;
const syncSoundtrack = (audio, at, music, active, outputGain) => {
  if (!audio || !music) return;
  const start = music.start ?? 0;
  const pointIn = music.in ?? 0;
  const pointOut = music.out ?? music.duration;
  const audible = at >= start && at < start + pointOut - pointIn;
  if (!audible || !active) audio.pause();
  const target = clamp(pointIn + at - start, pointIn, pointOut);
  if (Math.abs(audio.currentTime - target) > .2 && Number.isFinite(target)) audio.currentTime = target;
  const elapsed = at - start;
  const remaining = start + pointOut - pointIn - at;
  const fadeIn = music.fadeIn ?? 0;
  const fadeOut = music.fadeOut ?? 0;
  const fade = Math.min(1, fadeIn > 0 ? elapsed / fadeIn : 1, fadeOut > 0 ? remaining / fadeOut : 1);
  const level = audible && active ? clamp(music.volume ?? 1, 0, 1) * Math.max(0, fade) : 0;
  if (outputGain) { outputGain.gain.value = level; audio.volume = 1; }
  else audio.volume = level;
  if (audible && active && audio.paused) audio.play().catch(() => {});
};

function AudioClipInspector({ item, asset, onChange, onRemove }) {
  const duration = Math.max(.1, (item.out ?? item.duration) - (item.in ?? 0));
  const numberField = (label, value, min, max, key) => <label className="block">{label}<input type="number" min={min} max={max} step=".1" value={value} onChange={(event) => onChange({ [key]: clamp(Number(event.target.value) || 0, min, max) })} className="mt-1 w-full rounded-lg border border-border bg-black/40 p-2" /></label>;
  return <div className="mt-4 space-y-2 border-t border-border/70 pt-3 text-xs">
    <p className="truncate font-bold">Audio clip: {asset?.name}</p>
    {numberField("Timeline start (seconds)", item.start ?? 0, 0, 86400, "start")}
    {numberField("Song in point (seconds)", item.in ?? 0, 0, (item.out ?? item.duration) - .1, "in")}
    {numberField("Song out point (seconds)", item.out ?? item.duration, (item.in ?? 0) + .1, item.duration, "out")}
    {numberField("Fade in (seconds)", item.fadeIn ?? 0, 0, duration, "fadeIn")}
    {numberField("Fade out (seconds)", item.fadeOut ?? 0, 0, duration, "fadeOut")}
    <label className="block">Volume {Math.round((item.volume ?? 1) * 100)}%<input type="range" min="0" max="1" step=".01" value={item.volume ?? 1} onChange={(event) => onChange({ volume: Number(event.target.value) })} className="w-full accent-primary" /></label>
    <button className="text-rose-300" onClick={onRemove}>Remove audio clip</button>
  </div>;
}

export default function MusicVideoGenerator() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const mediaRef = useRef(new Map());
  const exportGainsRef = useRef(null);
  const cancelExportRef = useRef(false);
  const audioElementsRef = useRef(new Map());
  const rafRef = useRef(0);
  const playingRef = useRef(false);
  const timeRef = useRef(0);
  const startRef = useRef(0);
  const assetsRef = useRef([]);
  const clipsRef = useRef([]);
  const musicRef = useRef(null);
  const titleRef = useRef("");
  const restoredRef = useRef(false);
  const historyRef = useRef({ current: null, past: [], future: [] });
  const [, setHistoryVersion] = useState(0);
  const [assets, setAssets] = useState([]);
  const [clips, setClips] = useState([]);
  const [trackCount, setTrackCount] = useState(2);
  const [music, setMusic] = useState([]);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [output, setOutput] = useState("");
  const [outputFormat, setOutputFormat] = useState("webm");
  const [exportFormat, setExportFormat] = useState("webm");
  const [status, setStatus] = useState("");
  const [zoom, setZoom] = useState(60);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiConcept, setAiConcept] = useState("");
  const [aiStyle, setAiStyle] = useState("Cinematic animation");

  assetsRef.current = assets;
  clipsRef.current = clips;
  musicRef.current = music;
  titleRef.current = title;
  const length = projectLength(clips);
  const mp4Supported = typeof MediaRecorder !== "undefined" && ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1.42E01E", "video/mp4"].some((type) => MediaRecorder.isTypeSupported(type));
  const chosen = clips.find((clip) => clip.id === selected);
  const selectedAsset = assets.find((asset) => asset.id === chosen?.assetId);
  const currentTransform = chosen ? transformAt(chosen, time) : null;
  const keyframeTime = chosen ? Math.round(clamp(time - chosen.start, 0, clipLength(chosen)) * 100) / 100 : 0;
  const atKeyframe = chosen?.keyframes?.some((frame) => Math.abs(frame.time - keyframeTime) <= .01);

  const draw = useCallback((at) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#050509";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const visible = clipsRef.current.filter((clip) => at >= clip.start && at < clip.start + clipLength(clip)).sort((a, b) => (a.track ?? 0) - (b.track ?? 0));
    const activeIds = new Set(visible.map((clip) => clip.id));
    if (!exportGainsRef.current) for (const item of musicRef.current) syncSoundtrack(audioElementsRef.current.get(item.id), at, item, playingRef.current);
    for (const [id, element] of mediaRef.current) {
      if (element.tagName === "VIDEO" && !activeIds.has(id)) element.pause();
    }
    for (const [id, gain] of exportGainsRef.current || []) if (!activeIds.has(id)) gain.gain.value = 0;
    for (const clip of visible) {
      const transition = transitionState(clip, at);
      const source = mediaRef.current.get(clip.id);
      const asset = assetsRef.current.find((item) => item.id === clip.assetId);
      if (!source || !asset) continue;
      if (asset.kind === "video") {
        const sourceTime = clip.in + (at - clip.start);
        if (Math.abs(source.currentTime - sourceTime) > 0.16 && Number.isFinite(sourceTime)) {
          try { source.currentTime = sourceTime; } catch { /* seek may wait for metadata */ }
        }
        source.volume = exportGainsRef.current ? 1 : clamp(clip.volume ?? 1, 0, 1) * transition.audio;
        const gain = exportGainsRef.current?.get(clip.id);
        if (gain) gain.gain.value = clamp(clip.volume ?? 1, 0, 1) * transition.audio;
        if (playingRef.current && source.paused) source.play().catch(() => setStatus("Video audio was blocked. Tap Play again."));
      }
      const w = source.videoWidth || source.naturalWidth;
      const h = source.videoHeight || source.naturalHeight;
      if (w && h) {
        const scale = Math.max(WIDTH / w, HEIGHT / h);
        ctx.save();
        ctx.globalAlpha = transition.opacity;
        if (transition.type === "wipeLeft") {
          ctx.beginPath(); ctx.rect(0, 0, WIDTH * transition.reveal, HEIGHT); ctx.clip();
        } else if (transition.type === "wipeRight") {
          ctx.beginPath(); ctx.rect(WIDTH * (1 - transition.reveal), 0, WIDTH * transition.reveal, HEIGHT); ctx.clip();
        }
        ctx.filter = `brightness(${clip.brightness ?? 100}%) contrast(${clip.contrast ?? 100}%) saturate(${clip.saturation ?? 100}%)`;
        const transform = transformAt(clip, at);
        ctx.translate(WIDTH / 2 + transform.x * WIDTH / 100, HEIGHT / 2 + transform.y * HEIGHT / 100);
        ctx.scale(transform.scale, transform.scale);
        ctx.drawImage(source, -w * scale / 2, -h * scale / 2, w * scale, h * scale);
        ctx.restore();
      }
    }
    if (titleRef.current.trim()) {
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0, HEIGHT - 150, WIDTH, 120);
      ctx.font = "bold 54px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(titleRef.current.slice(0, 55), WIDTH / 2, HEIGHT - 73, WIDTH - 80);
    }
  }, []);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
    for (const audio of audioElementsRef.current.values()) audio.pause();
    for (const element of mediaRef.current.values()) if (element.tagName === "VIDEO") element.pause();
  }, []);

  const seek = (next) => {
    const value = clamp(next, 0, Math.max(length, 0));
    timeRef.current = value;
    setTime(value);
    for (const item of musicRef.current) syncSoundtrack(audioElementsRef.current.get(item.id), value, item, playingRef.current);
    if (playingRef.current) startRef.current = performance.now() - value * 1000;
    draw(value);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(PROJECT_KEY) || "null");
        if (!saved) { historyRef.current.current = JSON.stringify({ clips: [], music: [], title: "", trackCount: 2 }); restoredRef.current = true; return; }
        const restored = (await Promise.all((saved.assets || []).map(async (asset) => {
          const file = await loadFile(asset.id);
          return file ? { ...asset, url: URL.createObjectURL(file) } : null;
        }))).filter(Boolean);
        if (cancelled) { restored.forEach((asset) => URL.revokeObjectURL(asset.url)); return; }
        const ids = new Set(restored.map((asset) => asset.id));
        setAssets(restored);
        setClips((saved.clips || []).filter((clip) => ids.has(clip.assetId)));
        const restoredMusic = (Array.isArray(saved.music) ? saved.music : saved.music ? [saved.music] : []).filter((item) => ids.has(item.assetId)).map((item) => ({ ...item, id: item.id || crypto.randomUUID(), duration: restored.find((asset) => asset.id === item.assetId)?.duration ?? item.duration ?? 0 }));
        setMusic(restoredMusic);
        setTitle(saved.title || "");
        const count = Math.max(2, saved.trackCount || 2, ...(saved.clips || []).map((clip) => (clip.track ?? 0) + 1));
        setTrackCount(count);
        historyRef.current.current = JSON.stringify({ clips: (saved.clips || []).filter((clip) => ids.has(clip.assetId)), music: restoredMusic, title: saved.title || "", trackCount: count });
        restoredRef.current = true;
        setStatus("Saved project restored on this device.");
      } catch { restoredRef.current = true; setStatus("Saved project could not be restored. Import your media again."); }
    })();
    return () => { cancelled = true; stop(); };
  }, [stop]);

  useEffect(() => {
    const next = new Map();
    clips.forEach((clip) => {
      const asset = assets.find((item) => item.id === clip.assetId);
      if (!asset) return;
      let element = mediaRef.current.get(clip.id);
      if (!element) {
        element = document.createElement(asset.kind === "image" ? "img" : "video");
        element.preload = "auto";
        if (asset.kind === "video") { element.playsInline = true; element.onseeked = () => draw(timeRef.current); element.onloadeddata = () => draw(timeRef.current); }
        if (asset.kind === "image") element.onload = () => draw(timeRef.current);
        element.src = asset.url;
      }
      next.set(clip.id, element);
    });
    for (const [id, element] of mediaRef.current) if (!next.has(id) && element.tagName === "VIDEO") element.pause();
    mediaRef.current = next;
    draw(timeRef.current);
  }, [assets, clips, title, draw]);

  useEffect(() => {
    const next = new Map();
    for (const item of music) {
      const asset = assets.find((source) => source.id === item.assetId);
      if (!asset) continue;
      let audio = audioElementsRef.current.get(item.id);
      if (!audio) { audio = new Audio(asset.url); audio.preload = "auto"; }
      next.set(item.id, audio);
    }
    for (const [id, audio] of audioElementsRef.current) if (!next.has(id)) audio.pause();
    audioElementsRef.current = next;
    for (const item of music) syncSoundtrack(next.get(item.id), timeRef.current, item, playingRef.current);
  }, [assets, music]);

  useEffect(() => {
    if (!restoredRef.current) return;
    const snapshot = JSON.stringify({ clips, music, title, trackCount });
    const history = historyRef.current;
    if (history.current && history.current !== snapshot) {
      history.past.push(history.current);
      if (history.past.length > 100) history.past.shift();
      history.future = [];
      setHistoryVersion((version) => version + 1);
    }
    history.current = snapshot;
  }, [clips, music, title, trackCount]);

  const travel = (direction) => {
    const history = historyRef.current;
    const from = direction === "undo" ? history.past : history.future;
    const to = direction === "undo" ? history.future : history.past;
    if (!from.length) return;
    stop();
    to.push(history.current);
    const snapshot = from.pop();
    history.current = snapshot;
    const restored = JSON.parse(snapshot);
    setClips(restored.clips);
    setMusic(restored.music);
    setTitle(restored.title);
    setTrackCount(restored.trackCount ?? 2);
    setSelected(null);
    setHistoryVersion((version) => version + 1);
    setStatus(direction === "undo" ? "Edit undone." : "Edit redone.");
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (rendering || !(event.ctrlKey || event.metaKey) || !["z", "y"].includes(event.key.toLowerCase())) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]")) return;
      event.preventDefault();
      travel(event.shiftKey || event.key.toLowerCase() === "y" ? "redo" : "undo");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      localStorage.setItem(PROJECT_KEY, JSON.stringify({
        assets: assets.map(({ id, name, kind, duration }) => ({ id, name, kind, duration })),
        clips, music, title, trackCount,
      }));
    } catch { setStatus("Project storage is full. Export soon and free device space."); }
  }, [assets, clips, music, title, trackCount]);

  useEffect(() => () => { assetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.url)); }, []);
  useEffect(() => { if (output) return () => URL.revokeObjectURL(output); }, [output]);

  const importFiles = async (files) => {
    if (!files?.length) return;
    setStatus("Importing media...");
    const added = [];
    for (const file of files) {
      const kind = kindOf(file);
      if (!kind) { setStatus(`Unsupported file: ${file.name}`); continue; }
      const id = crypto.randomUUID();
      const url = URL.createObjectURL(file);
      try {
        const duration = kind === "image" ? 5 : await metadata(url, kind);
        await storeFile(id, file);
        added.push({ id, name: file.name, kind, duration, url });
      } catch (error) {
        URL.revokeObjectURL(url);
        setStatus(`${file.name}: ${error.message || "Import failed"}`);
      }
    }
    if (added.length) { setAssets((current) => [...current, ...added]); setStatus(`${added.length} file(s) imported and saved on this device.`); }
  };

  const generateAiVideo = async () => {
    if (aiGenerating || rendering) return;
    const song = assets.find((asset) => asset.kind === "audio");
    if (!song) { setStatus("Import a song first, then generate the AI video."); return; }
    const storedSong = await loadFile(song.id);
    if (!storedSong) { setStatus("The song file is unavailable on this device. Import it again."); return; }
    setAiGenerating(true);
    setStatus("Uploading song and creating an AI-directed storyboard...");
    try {
      const uploaded = await secureUploadFile(storedSong, { accept: "audio" });
      const response = await base44.functions.invoke("generateMusicVideoStoryboard", {
        audio_url: uploaded.file_url, title: title || song.name.replace(/\\.[^.]+$/, ""),
        concept: aiConcept, style: aiStyle, duration: song.duration,
      });
      const payload = response?.data ?? response;
      if (payload?.error) throw new Error(payload.error);
      const scenes = Array.isArray(payload?.scenes) ? payload.scenes.filter((scene) => scene?.image_url) : [];
      if (!scenes.length) throw new Error("No AI scenes were generated. Try again.");
      const sceneDuration = Math.max(2, song.duration / scenes.length);
      const generatedAssets = [], generatedClips = [];
      for (let index = 0; index < scenes.length; index++) {
        const scene = scenes[index], imageResponse = await fetch(scene.image_url);
        if (!imageResponse.ok) continue;
        const blob = await imageResponse.blob();
        const file = new File([blob], `AI Scene ${index + 1}.png`, { type: blob.type || "image/png" });
        const id = crypto.randomUUID();
        await storeFile(id, file);
        generatedAssets.push({ id, name: file.name, kind: "image", duration: sceneDuration, url: URL.createObjectURL(file), aiScene: scene });
        generatedClips.push({ id: crypto.randomUUID(), assetId: id, track: 0, start: index * sceneDuration, in: 0, out: sceneDuration, sourceDuration: sceneDuration, brightness: 100, contrast: 100, saturation: 100, volume: 1, fadeIn: .45, fadeOut: .45, transitionIn: index ? "fade" : "cut", keyframes: [{ time: 0, x: 0, y: 0, scale: 1 }, { time: sceneDuration, x: index % 2 ? -2 : 2, y: index % 3 ? 1 : -1, scale: 1.08 }] });
      }
      if (!generatedAssets.length) throw new Error("AI scenes were created but could not be downloaded.");
      setAssets((current) => [...current, ...generatedAssets]);
      setClips((current) => [...current.filter((clip) => (clip.track ?? 0) !== 0), ...generatedClips]);
      if (!music.find((item) => item.assetId === song.id)) setMusic((current) => [...current, { id: crypto.randomUUID(), assetId: song.id, duration: song.duration, volume: 1, start: 0, in: 0, out: song.duration, fadeIn: 0, fadeOut: 0 }]);
      setTitle((current) => current || song.name.replace(/\\.[^.]+$/, ""));
      seek(0);
      setStatus(`AI video created: ${generatedAssets.length} animated scenes are now on the timeline. Preview, edit, then export.`);
    } catch (error) { setStatus(`AI generation failed: ${error.message || "Unknown error"}`); }
    finally { setAiGenerating(false); }
  };

  const addClip = (asset) => {
    if (asset.kind === "audio") {
      const audioClip = { id: crypto.randomUUID(), assetId: asset.id, duration: asset.duration, volume: 1, start: 0, in: 0, out: asset.duration, fadeIn: 0, fadeOut: 0 };
      setMusic((current) => [...current, audioClip]);
      setSelectedMusic(audioClip.id);
      setStatus("Audio clip added. Select it on the timeline to edit timing and volume.");
      return;
    }
    const track = chosen?.track ?? 0;
    const start = Math.max(0, ...clips.filter((clip) => (clip.track ?? 0) === track).map((clip) => clip.start + clipLength(clip)));
    const clip = { id: crypto.randomUUID(), assetId: asset.id, track, start, in: 0, out: asset.duration, sourceDuration: asset.duration, brightness: 100, contrast: 100, saturation: 100, volume: 1, fadeIn: .3, fadeOut: .3, transitionIn: "fade" };
    setClips((current) => [...current, clip]);
    setSelected(clip.id);
  };

  const updateClip = (patch) => setClips((current) => current.map((clip) => clip.id === selected ? { ...clip, ...patch } : clip));
  const removeAsset = async (asset) => {
    stop();
    const remaining = clips.filter((clip) => clip.assetId !== asset.id);
    const nextMusic = music.filter((item) => item.assetId !== asset.id);
    historyRef.current = { current: JSON.stringify({ clips: remaining, music: nextMusic, title, trackCount }), past: [], future: [] };
    setHistoryVersion((version) => version + 1);
    setClips(remaining);
    setMusic(nextMusic);
    setAssets((current) => current.filter((item) => item.id !== asset.id));
    await deleteFile(asset.id);
    URL.revokeObjectURL(asset.url);
  };

  const play = () => {
    if (playingRef.current) { stop(); return; }
    if (!length) return;
    if (timeRef.current >= length) seek(0);
    playingRef.current = true;
    setPlaying(true);
    startRef.current = performance.now() - timeRef.current * 1000;
    for (const item of musicRef.current) syncSoundtrack(audioElementsRef.current.get(item.id), timeRef.current, item, true);
    const tick = () => {
      if (!playingRef.current) return;
      const next = Math.min(projectLength(clipsRef.current), (performance.now() - startRef.current) / 1000);
      timeRef.current = next;
      setTime(next);
      draw(next);
      if (next >= projectLength(clipsRef.current)) { stop(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    draw(timeRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  const exportVideo = async () => {
    if (!length || rendering) return;
    if (!canvasRef.current?.captureStream || !window.MediaRecorder) { setStatus("This browser cannot export video. Use current Chrome or Edge."); return; }
    const formats = exportFormat === "mp4" ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1.42E01E", "video/mp4"] : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const mime = formats.find((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) { setStatus(`${exportFormat.toUpperCase()} recording is unavailable in this browser. Select WebM or use a supported browser.`); return; }
    stop();
    seek(0);
    cancelExportRef.current = false;
    setRendering(true);
    setStatus("Exporting in real time. Keep this tab open until the video finishes.");
    let context;
    let stream;
    const exportAudio = new Map();
    let recorder;
    const previewMedia = mediaRef.current;
    try {
      const videoClips = clips.filter((clip) => assets.some((asset) => asset.id === clip.assetId && asset.kind === "video"));
      const exportMedia = new Map(previewMedia);
      const gains = new Map();
      context = new AudioContext();
      const mix = context.createMediaStreamDestination();
      for (const clip of videoClips) {
        const asset = assets.find((item) => item.id === clip.assetId);
        const video = document.createElement("video");
        video.src = asset.url;
        video.preload = "auto";
        video.playsInline = true;
        video.onseeked = () => draw(timeRef.current);
        exportMedia.set(clip.id, video);
        const source = context.createMediaElementSource(video);
        const gain = context.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(mix);
        gains.set(clip.id, gain);
      }
      await Promise.all(videoClips.map((clip) => new Promise((resolve, reject) => {
        const video = exportMedia.get(clip.id);
        if (video.readyState >= 2) return resolve();
        video.onloadeddata = resolve;
        video.onerror = () => reject(new Error("Cannot decode video clip for export."));
      })));
      mediaRef.current = exportMedia;
      exportGainsRef.current = gains;
      for (const item of music) {
        const url = assets.find((asset) => asset.id === item.assetId)?.url;
        if (!url) continue;
        const audio = new Audio(url);
        audio.preload = "auto";
        const source = context.createMediaElementSource(audio);
        const gain = context.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(mix);
        exportAudio.set(item.id, { audio, gain });
      }
      const canvasStream = canvasRef.current.captureStream(30);
      stream = new MediaStream(canvasStream.getVideoTracks());
      if (videoClips.length || exportAudio.size) mix.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      await context.resume();
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const parts = [];
      recorder.ondataavailable = (event) => { if (event.data.size) parts.push(event.data); };
      const finished = new Promise((resolve, reject) => {
        recorder.onerror = (event) => reject(event.error || new Error("Recorder failed"));
        recorder.onstop = () => resolve(new Blob(parts, { type: mime }));
      });
      playingRef.current = true;
      draw(0);
      for (const item of music) { const output = exportAudio.get(item.id); if (output) syncSoundtrack(output.audio, 0, item, true, output.gain); }
      recorder.start(1000);
      const start = performance.now();
      const frame = () => {
        if (recorder.state === "inactive") return;
        if (cancelExportRef.current) { recorder.stop(); return; }
        const next = Math.min(length, (performance.now() - start) / 1000);
        timeRef.current = next;
        draw(next);
        for (const item of music) { const output = exportAudio.get(item.id); if (output) syncSoundtrack(output.audio, next, item, true, output.gain); }
        setTime(next);
        if (next >= length) recorder.stop();
        else rafRef.current = requestAnimationFrame(frame);
      };
      rafRef.current = requestAnimationFrame(frame);
      const blob = await finished;
      if (cancelExportRef.current) setStatus("Export canceled.");
      else {
        setOutput(URL.createObjectURL(blob));
        setOutputFormat(exportFormat);
        setStatus(`Export ready: ${(blob.size / 1048576).toFixed(1)} MB ${exportFormat.toUpperCase()}.`);
      }
    } catch (error) {
      setStatus(`Export failed: ${error.message || "Unknown error"}`);
    } finally {
      playingRef.current = false;
      cancelAnimationFrame(rafRef.current);
      if (recorder?.state === "recording") recorder.stop();
      for (const output of exportAudio.values()) output.audio.pause();
      for (const [id, element] of mediaRef.current) if (element.tagName === "VIDEO") { element.pause(); if (element !== previewMedia.get(id)) element.onseeked = null; }
      mediaRef.current = previewMedia;
      exportGainsRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      await context?.close();
      setRendering(false);
      draw(timeRef.current);
    }
  };

  const hasAudio = assets.some((asset) => asset.kind === "audio");

  return <div className="h-full overflow-y-auto bg-background px-3 pb-[max(6rem,env(safe-area-inset-bottom))] pt-4 text-foreground sm:px-6">
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-start gap-3 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card px-4 py-5 sm:items-center sm:px-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft /></Button>
        <div className="min-w-0 flex-1 basis-[calc(100%-4rem)] sm:basis-56"><h1 className="font-heading text-2xl font-black tracking-tight sm:text-3xl">Music Video Lab</h1><p className="mt-1 text-sm text-muted-foreground">Turn a song into an editable storyboard or cut your own footage.</p></div>
        <Button variant="outline" onClick={() => travel("undo")} disabled={!historyRef.current.past.length || rendering} aria-label="Undo edit" title="Undo edit"><Undo2 size={16} /></Button>
        <Button variant="outline" onClick={() => travel("redo")} disabled={!historyRef.current.future.length || rendering} aria-label="Redo edit" title="Redo edit"><Redo2 size={16} /></Button>
        <span className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"><Save size={15} /> Local project</span>
      </header>
      <nav aria-label="Video Lab sections" className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:flex-wrap">
        {[
          ["video-lab-media", "Project media"],
          ["video-lab-preview", "Preview & export"],
          ["video-lab-timeline", "Timeline"],
          ["video-lab-inspector", "Inspector"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={(event) => {
            event.preventDefault();
            document.getElementById(id)?.focus({ preventScroll: true });
            document.getElementById(id)?.scrollIntoView({ block: "start" });
          }} className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{label}</a>
        ))}
      </nav>
      <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] xl:items-end">
          <div className="min-w-0 sm:col-span-2 xl:col-span-1"><h2 className="flex items-center gap-2 font-heading font-bold"><Sparkles size={17} className="shrink-0 text-primary" aria-hidden="true" /> AI Music Video Director</h2><p className="mt-1 text-sm text-muted-foreground">{hasAudio ? "Describe your concept and pick a style to create an editable animated storyboard." : "Import an audio track in Project media to enable AI generation."}</p></div>
          <label className="min-w-0 text-sm font-medium text-muted-foreground">Concept<input value={aiConcept} onChange={(e) => setAiConcept(e.target.value)} maxLength={2000} placeholder="Neon city, heartbreak, surreal fire..." className="mt-1 w-full rounded-lg border border-border bg-black/40 p-2 text-foreground" /></label>
          <label className="min-w-0 text-sm font-medium text-muted-foreground">Style<select value={aiStyle} onChange={(e) => setAiStyle(e.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-secondary p-2 text-foreground"><option>Cinematic animation</option><option>Anime-inspired original</option><option>3D surreal</option><option>Graphic novel</option><option>Dreamlike watercolor</option><option>Dark futuristic</option></select></label>
          <Button onClick={generateAiVideo} className="min-h-11 sm:col-span-2 xl:col-span-1" disabled={aiGenerating || rendering || !hasAudio}>{aiGenerating ? "Directing..." : "Generate AI Video"}</Button>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(14rem,0.8fr)_minmax(0,1.6fr)] xl:grid-cols-[minmax(14rem,0.8fr)_minmax(0,1.8fr)_minmax(14rem,0.85fr)]">
        <section id="video-lab-media" tabIndex={-1} className="order-2 min-w-0 scroll-mt-4 rounded-2xl border border-border/70 bg-card/60 p-4 lg:order-1">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><FolderOpen size={18} /> Project media</h2>
          <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 text-center text-sm font-medium hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary"><Upload size={20} className="mb-1" /> Import video, images or audio<input type="file" accept="video/*,image/*,audio/*" multiple className="sr-only" onChange={(event) => { importFiles([...event.target.files]); event.target.value = ""; }} /></label>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{assets.map((asset) => <div key={asset.id} className="flex items-center gap-2 rounded-lg border border-border/70 p-2"><Film size={15} className="shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold" title={asset.name}>{asset.name}</p><p className="text-[11px] text-muted-foreground">{asset.kind} · {formatTime(asset.duration)}</p></div><button onClick={() => addClip(asset)} aria-label={`Add ${asset.name} to timeline`} title="Add to timeline" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"><Plus size={17}/></button><button onClick={() => removeAsset(asset)} aria-label={`Remove ${asset.name}`} title="Remove from project" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"><Trash2 size={15}/></button></div>)}</div>
          {!assets.length && <p className="mt-3 text-xs text-muted-foreground">Add a song for AI generation, or import footage and images to edit by hand.</p>}
        </section>
        <section id="video-lab-preview" tabIndex={-1} className="order-1 min-w-0 scroll-mt-4 rounded-2xl border border-border/70 bg-card/60 p-3 sm:p-4 lg:order-2">
          <h2 className="mb-3 font-heading font-bold">Preview &amp; export</h2>
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="aspect-video w-full rounded-xl bg-black" aria-label="Video preview" />
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
            <Button onClick={play} disabled={!length || rendering} aria-label={playing ? "Pause preview" : "Play preview"}>{playing ? <Pause size={16}/> : <Play size={16}/>}</Button>
            <span className="font-mono text-sm">{formatTime(time)} / {formatTime(length)}</span>
            <input aria-label="Playhead" type="range" min="0" max={Math.max(length, 0.1)} step=".01" value={Math.min(time, Math.max(length, .1))} onChange={(e) => seek(Number(e.target.value))} className="min-h-11 min-w-24 basis-full flex-1 accent-primary sm:basis-auto" />
            <label className="text-xs text-muted-foreground">Format <select aria-label="Export format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} disabled={rendering} className="ml-1 rounded border border-border bg-secondary p-2 text-foreground"><option value="webm">WebM</option><option value="mp4" disabled={!mp4Supported}>MP4{mp4Supported ? "" : " (unavailable)"}</option></select></label>
            <Button onClick={exportVideo} disabled={!length || rendering}><Film size={16} className="mr-2" />{rendering ? "Exporting..." : `Export ${exportFormat.toUpperCase()}`}</Button>
            {rendering && <Button variant="outline" onClick={() => { cancelExportRef.current = true; setStatus("Canceling export..."); }}>Cancel export</Button>}
            {output && <a href={output} download={`nalibase-music-video.${outputFormat}`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Download size={16} /> Download</a>}
          </div>

          <p role="status" className="mt-3 min-h-5 text-sm text-muted-foreground">{status || (!length ? "Add media to the timeline or generate a storyboard to preview and export." : "")}</p>
        </section>
        <section id="video-lab-inspector" tabIndex={-1} className="order-3 min-w-0 scroll-mt-4 rounded-2xl border border-border/70 bg-card/60 p-4 lg:col-span-2 xl:col-span-1">
          <h2 className="mb-3 font-heading font-bold">Inspector</h2>
          <label className="block text-xs text-muted-foreground">Video title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={55} placeholder="Optional title overlay" className="mt-1 w-full rounded-lg border border-border bg-black/40 p-2 text-foreground" /></label>
          {chosen && <div className="mt-4 space-y-3 border-t border-border/70 pt-4 text-xs">
            <p className="truncate font-bold">{selectedAsset?.name}</p>
            <label className="block">Video track<select value={chosen.track ?? 0} onChange={(e) => updateClip({ track: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-border bg-secondary p-2">{Array.from({ length: trackCount }, (_, i) => <option key={i} value={i}>Video {i + 1}</option>)}</select></label>
            <label className="block">Start (seconds)<input type="number" min="0" step=".1" value={chosen.start} onChange={(e) => updateClip({ start: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-full rounded-lg border border-border bg-black/40 p-2" /></label>
            <label className="block">In point (seconds)<input type="number" min="0" max={chosen.out - .1} step=".1" value={chosen.in} onChange={(e) => setClips((current) => trimClip(current, selected, "left", chosen.start + Number(e.target.value) - chosen.in))} className="mt-1 w-full rounded-lg border border-border bg-black/40 p-2" /></label>
            <label className="block">Out point (seconds)<input type="number" min={chosen.in + .1} max={chosen.sourceDuration} step=".1" value={chosen.out} onChange={(e) => setClips((current) => trimClip(current, selected, "right", Number(e.target.value)))} className="mt-1 w-full rounded-lg border border-border bg-black/40 p-2" /></label>
            <label className="block">Entrance transition<select value={chosen.transitionIn ?? "fade"} onChange={(e) => updateClip({ transitionIn: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-secondary p-2"><option value="fade">Dissolve</option><option value="cut">Cut</option><option value="wipeLeft">Wipe left to right</option><option value="wipeRight">Wipe right to left</option></select></label>
            <label className="block">Entrance length (seconds)<input type="number" min="0" max={clipLength(chosen)} step=".1" value={chosen.fadeIn ?? .3} onChange={(e) => updateClip({ fadeIn: clamp(Number(e.target.value) || 0, 0, clipLength(chosen)) })} className="mt-1 w-full rounded-lg border border-border bg-black/40 p-2" /></label>
            <label className="block">Fade out (seconds)<input type="number" min="0" max={clipLength(chosen)} step=".1" value={chosen.fadeOut ?? .3} onChange={(e) => updateClip({ fadeOut: clamp(Number(e.target.value) || 0, 0, clipLength(chosen)) })} className="mt-1 w-full rounded-lg border border-border bg-black/40 p-2" /></label>
            <div className="rounded-lg border border-border/70 p-2"><p className="font-semibold">Transform at {formatTime(keyframeTime)} in clip</p><div className="mt-2 grid grid-cols-3 gap-2">{[["x", "X %", -100, 100, 1], ["y", "Y %", -100, 100, 1], ["scale", "Scale", .25, 4, .05]].map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" min={min} max={max} step={step} value={Math.round(currentTransform[key] * 100) / 100} onChange={(e) => setClips((current) => current.map((clip) => clip.id === selected ? setTransformKeyframe(clip, time, { [key]: clamp(Number(e.target.value) || 0, min, max) }) : clip))} className="mt-1 w-full rounded border border-border bg-black/40 p-1" /></label>)}</div><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => setClips((current) => current.map((clip) => clip.id === selected ? setTransformKeyframe(clip, time) : clip))}>{atKeyframe ? "Update keyframe" : "Add keyframe"}</Button>{atKeyframe && <Button size="sm" variant="outline" onClick={() => setClips((current) => current.map((clip) => clip.id === selected ? removeTransformKeyframe(clip, time) : clip))}>Remove keyframe</Button>}</div><p className="mt-2 text-muted-foreground">Set the playhead, then change X, Y or scale. Values animate between keyframes.</p></div>
            {selectedAsset?.kind === "video" && <label className="block">Clip volume: {Math.round((chosen.volume ?? 1) * 100)}%<input type="range" min="0" max="1" step=".01" value={chosen.volume ?? 1} onChange={(e) => updateClip({ volume: Number(e.target.value) })} className="mt-1 w-full accent-primary" /></label>}
            {["brightness", "contrast", "saturation"].map((key) => <label key={key} className="block capitalize">{key}: {chosen[key]}%<input type="range" min="0" max="200" value={chosen[key]} onChange={(e) => updateClip({ [key]: Number(e.target.value) })} className="mt-1 w-full accent-primary" /></label>)}
            <Button variant="outline" onClick={() => { setClips((current) => splitClip(current, selected, time)); setStatus("Split at playhead when it falls inside the selected clip."); }}><Scissors size={15} className="mr-2"/> Split at playhead</Button>
            <Button variant="destructive" onClick={() => { setClips((current) => current.filter((clip) => clip.id !== selected)); setSelected(null); }}><Trash2 size={15} className="mr-2"/> Delete clip</Button>
          </div>}
          {music.length > 0 && <AudioClipInspector item={music.find((item) => item.id === selectedMusic) || music[0]} asset={assets.find((asset) => asset.id === (music.find((item) => item.id === selectedMusic) || music[0]).assetId)} onChange={(patch) => { const id = (music.find((item) => item.id === selectedMusic) || music[0]).id; setMusic((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); }} onRemove={() => { const id = (music.find((item) => item.id === selectedMusic) || music[0]).id; setMusic((current) => current.filter((item) => item.id !== id)); setSelectedMusic(null); }} />}
        </section>
      </div>
      <section id="video-lab-timeline" tabIndex={-1} className="min-w-0 scroll-mt-4 rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Timeline · Video and soundtrack</h2><Button variant="outline" size="sm" onClick={() => setTrackCount((count) => count + 1)}><Plus size={14} className="mr-1" /> Add video track</Button><label className="text-xs">Zoom <input type="range" min="20" max="160" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="align-middle accent-primary" /></label></div>
        <div aria-label="Scrollable timeline tracks" role="region" tabIndex={0} className="w-full max-w-full touch-pan-x overflow-x-auto overscroll-x-contain rounded-xl border border-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><div style={{ width: Math.max(700, length * zoom + 120) }} className="relative min-h-40 rounded-lg bg-black/40 p-2">
          <div className="ml-20 h-5 border-b border-border/70 font-mono text-[10px] text-muted-foreground">{Array.from({ length: Math.ceil(Math.max(length, 10) / 5) + 1 }, (_, i) => <span key={i} className="absolute" style={{ left: 90 + i * 5 * zoom }}>{i * 5}s</span>)}</div>
          {Array.from({ length: trackCount }, (_, track) => <div key={track} className="mt-2 flex h-16 items-center"><span className="w-20 shrink-0 text-xs text-muted-foreground">VIDEO {track + 1}</span><div className="relative h-14 flex-1 rounded bg-secondary/60" onClick={(e) => { if (e.target === e.currentTarget) seek(e.nativeEvent.offsetX / zoom); }}>{clips.filter((clip) => (clip.track ?? 0) === track).map((clip) => <button key={clip.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", clip.id); }} onDragEnd={(e) => { if (e.dataTransfer.dropEffect === "none" && e.clientX === 0) return; const rail = e.currentTarget.parentElement.getBoundingClientRect(); setClips((current) => current.map((item) => item.id === clip.id ? { ...item, start: Math.max(0, Math.round((e.clientX - rail.left) / zoom * 10) / 10) } : item)); }} onClick={() => { setSelected(clip.id); seek(clip.start); }} style={{ left: clip.start * zoom, width: clipLength(clip) * zoom }} className={`absolute top-1 h-12 overflow-hidden rounded border px-2 text-left text-xs ${selected === clip.id ? "border-primary/60 bg-primary text-primary-foreground" : "border-primary/40 bg-primary/25 text-foreground"}`} title="Click to select; drag to move"><span className="block truncate font-bold">{assets.find((asset) => asset.id === clip.assetId)?.name}</span><span>{formatTime(clipLength(clip))}</span></button>)}</div></div>)}
          {music.map((item, index) => <div key={item.id} className="flex h-12 items-center"><span className="w-20 shrink-0 text-xs text-muted-foreground">AUDIO {index + 1}</span><div className="h-9 flex-1 rounded bg-secondary/60"><button onClick={() => { setSelectedMusic(item.id); seek(item.start ?? 0); }} style={{ marginLeft: (item.start ?? 0) * zoom, width: Math.max(0, Math.min((item.out ?? item.duration) - (item.in ?? 0), length - (item.start ?? 0))) * zoom }} className={`h-full truncate rounded border px-2 py-2 text-left text-xs ${selectedMusic === item.id ? "border-accent/60 bg-accent text-accent-foreground" : "border-accent/40 bg-accent/25 text-foreground"}`}>{assets.find((asset) => asset.id === item.assetId)?.name}</button></div></div>)}
          <div className="pointer-events-none absolute top-5 bottom-2 w-px bg-foreground" style={{ left: 90 + time * zoom }} />
        </div></div>
        <p className="mt-2 text-xs text-muted-foreground">Swipe sideways to explore the timeline on a phone. Tap a clip and use the Inspector to adjust its start time, trim, split, transition, grade or delete it. On desktop, drag a video clip to move it. Import your own media. Export plays in real time and mixes video clip audio with all imported audio clips.</p>
      </section>
    </div>
  </div>;
}