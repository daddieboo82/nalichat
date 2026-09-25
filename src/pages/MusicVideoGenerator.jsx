import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Film, FolderOpen, Pause, Play, Plus, Save, Scissors, Trash2, Undo2, Redo2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clamp, clipLength, formatTime, projectLength, splitClip, trimClip } from "@/lib/videoTimeline";

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

export default function MusicVideoGenerator() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const mediaRef = useRef(new Map());
  const exportGainsRef = useRef(null);
  const audioRef = useRef(null);
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
  const [music, setMusic] = useState(null);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");
  const [zoom, setZoom] = useState(60);

  assetsRef.current = assets;
  clipsRef.current = clips;
  musicRef.current = music;
  titleRef.current = title;
  const length = projectLength(clips);
  const chosen = clips.find((clip) => clip.id === selected);
  const selectedAsset = assets.find((asset) => asset.id === chosen?.assetId);

  const draw = useCallback((at) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#050509";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const visible = clipsRef.current.filter((clip) => at >= clip.start && at < clip.start + clipLength(clip));
    const clip = visible.at(-1);
    for (const [id, gain] of exportGainsRef.current || []) gain.gain.value = id === clip?.assetId ? clamp(clip.volume ?? 1, 0, 1) : 0;
    for (const [id, element] of mediaRef.current) {
      if (element.tagName === "VIDEO" && id !== clip?.assetId) element.pause();
    }
    if (clip) {
      const source = mediaRef.current.get(clip.assetId);
      const asset = assetsRef.current.find((item) => item.id === clip.assetId);
      if (source && asset) {
        if (asset.kind === "video") {
          const sourceTime = clip.in + (at - clip.start);
          if (Math.abs(source.currentTime - sourceTime) > 0.16 && Number.isFinite(sourceTime)) {
            try { source.currentTime = sourceTime; } catch { /* seek may wait for metadata */ }
          }
          source.volume = exportGainsRef.current ? 1 : clamp(clip.volume ?? 1, 0, 1);
          if (playingRef.current && source.paused) source.play().catch(() => setStatus("Video audio was blocked. Tap Play again."));
        }
        const w = source.videoWidth || source.naturalWidth;
        const h = source.videoHeight || source.naturalHeight;
        if (w && h) {
          const scale = Math.max(WIDTH / w, HEIGHT / h);
          ctx.save();
          ctx.globalAlpha = Math.min(1, (at - clip.start) / 0.3, (clip.start + clipLength(clip) - at) / 0.3);
          ctx.filter = `brightness(${clip.brightness ?? 100}%) contrast(${clip.contrast ?? 100}%) saturate(${clip.saturation ?? 100}%)`;
          ctx.drawImage(source, (WIDTH - w * scale) / 2, (HEIGHT - h * scale) / 2, w * scale, h * scale);
          ctx.restore();
        }
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
    audioRef.current?.pause();
    for (const element of mediaRef.current.values()) if (element.tagName === "VIDEO") element.pause();
  }, []);

  const seek = (next) => {
    const value = clamp(next, 0, Math.max(length, 0));
    timeRef.current = value;
    setTime(value);
    if (audioRef.current && musicRef.current) audioRef.current.currentTime = clamp(value, 0, musicRef.current.duration);
    if (playingRef.current) startRef.current = performance.now() - value * 1000;
    draw(value);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(PROJECT_KEY) || "null");
        if (!saved) { restoredRef.current = true; return; }
        const restored = (await Promise.all((saved.assets || []).map(async (asset) => {
          const file = await loadFile(asset.id);
          return file ? { ...asset, url: URL.createObjectURL(file) } : null;
        }))).filter(Boolean);
        if (cancelled) { restored.forEach((asset) => URL.revokeObjectURL(asset.url)); return; }
        const ids = new Set(restored.map((asset) => asset.id));
        setAssets(restored);
        setClips((saved.clips || []).filter((clip) => ids.has(clip.assetId)));
        setMusic(saved.music && ids.has(saved.music.assetId) ? saved.music : null);
        setTitle(saved.title || "");
        restoredRef.current = true;
        setStatus("Saved project restored on this device.");
      } catch { restoredRef.current = true; setStatus("Saved project could not be restored. Import your media again."); }
    })();
    return () => { cancelled = true; stop(); };
  }, [stop]);

  useEffect(() => {
    const next = new Map();
    assets.forEach((asset) => {
      let element = mediaRef.current.get(asset.id);
      if (!element) {
        element = document.createElement(asset.kind === "image" ? "img" : asset.kind === "audio" ? "audio" : "video");
        element.preload = "auto";
        if (asset.kind === "video") { element.playsInline = true; element.onseeked = () => draw(timeRef.current); element.onloadeddata = () => draw(timeRef.current); }
        if (asset.kind === "image") element.onload = () => draw(timeRef.current);
        element.src = asset.url;
      }
      next.set(asset.id, element);
    });
    mediaRef.current = next;
    draw(timeRef.current);
  }, [assets, clips, title, draw]);

  useEffect(() => {
    if (!restoredRef.current) return;
    const snapshot = JSON.stringify({ clips, music, title });
    const history = historyRef.current;
    if (history.current && history.current !== snapshot) {
      history.past.push(history.current);
      if (history.past.length > 100) history.past.shift();
      history.future = [];
      setHistoryVersion((version) => version + 1);
    }
    history.current = snapshot;
  }, [clips, music, title]);

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
    setSelected(null);
    setHistoryVersion((version) => version + 1);
    setStatus(direction === "undo" ? "Edit undone." : "Edit redone.");
  };

  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      localStorage.setItem(PROJECT_KEY, JSON.stringify({
        assets: assets.map(({ id, name, kind, duration }) => ({ id, name, kind, duration })),
        clips, music, title,
      }));
    } catch { setStatus("Project storage is full. Export soon and free device space."); }
  }, [assets, clips, music, title]);

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

  const addClip = (asset) => {
    if (asset.kind === "audio") {
      setMusic({ assetId: asset.id, duration: asset.duration, volume: 1 });
      setStatus("Soundtrack loaded. It will play alongside audio from your video clips.");
      return;
    }
    const start = projectLength(clips);
    const clip = { id: crypto.randomUUID(), assetId: asset.id, start, in: 0, out: asset.duration, sourceDuration: asset.duration, brightness: 100, contrast: 100, saturation: 100, volume: 1 };
    setClips((current) => [...current, clip]);
    setSelected(clip.id);
  };

  const updateClip = (patch) => setClips((current) => current.map((clip) => clip.id === selected ? { ...clip, ...patch } : clip));
  const removeAsset = async (asset) => {
    stop();
    setClips((current) => current.filter((clip) => clip.assetId !== asset.id));
    if (music?.assetId === asset.id) setMusic(null);
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
    const soundtrack = audioRef.current;
    if (soundtrack && musicRef.current) {
      soundtrack.currentTime = clamp(timeRef.current, 0, musicRef.current.duration);
      soundtrack.volume = musicRef.current.volume;
      soundtrack.play().catch(() => setStatus("Tap Play again to allow audio playback."));
    }
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
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) { setStatus("This browser does not support WebM export."); return; }
    stop();
    seek(0);
    setRendering(true);
    setStatus("Exporting in real time. Keep this tab open until the video finishes.");
    let context;
    let stream;
    let exportAudio;
    let recorder;
    const previewMedia = mediaRef.current;
    try {
      const videoAssets = assets.filter((asset) => asset.kind === "video" && clips.some((clip) => clip.assetId === asset.id));
      const exportMedia = new Map(previewMedia);
      const gains = new Map();
      context = new AudioContext();
      const mix = context.createMediaStreamDestination();
      for (const asset of videoAssets) {
        const video = document.createElement("video");
        video.src = asset.url;
        video.preload = "auto";
        video.playsInline = true;
        video.onseeked = () => draw(timeRef.current);
        exportMedia.set(asset.id, video);
        const source = context.createMediaElementSource(video);
        const gain = context.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(mix);
        gain.connect(context.destination);
        gains.set(asset.id, gain);
      }
      await Promise.all(videoAssets.map((asset) => new Promise((resolve, reject) => {
        const video = exportMedia.get(asset.id);
        if (video.readyState >= 2) return resolve();
        video.onloadeddata = resolve;
        video.onerror = () => reject(new Error(`Cannot decode ${asset.name} for export.`));
      })));
      mediaRef.current = exportMedia;
      exportGainsRef.current = gains;
      const soundtrackUrl = assets.find((asset) => asset.id === music?.assetId)?.url;
      if (soundtrackUrl) {
        exportAudio = new Audio(soundtrackUrl);
        exportAudio.preload = "auto";
        const source = context.createMediaElementSource(exportAudio);
        const gain = context.createGain();
        gain.gain.value = music.volume;
        source.connect(gain).connect(mix);
        gain.connect(context.destination);
      }
      const canvasStream = canvasRef.current.captureStream(30);
      stream = new MediaStream(canvasStream.getVideoTracks());
      if (videoAssets.length || soundtrackUrl) mix.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
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
      if (exportAudio) { exportAudio.currentTime = 0; await exportAudio.play(); }
      recorder.start(1000);
      const start = performance.now();
      const frame = () => {
        if (recorder.state === "inactive") return;
        const next = Math.min(length, (performance.now() - start) / 1000);
        timeRef.current = next;
        draw(next);
        setTime(next);
        if (next >= length) recorder.stop();
        else rafRef.current = requestAnimationFrame(frame);
      };
      rafRef.current = requestAnimationFrame(frame);
      const blob = await finished;
      setOutput(URL.createObjectURL(blob));
      setStatus(`Export ready: ${(blob.size / 1048576).toFixed(1)} MB WebM.`);
    } catch (error) {
      setStatus(`Export failed: ${error.message || "Unknown error"}`);
    } finally {
      playingRef.current = false;
      cancelAnimationFrame(rafRef.current);
      if (recorder?.state === "recording") recorder.stop();
      exportAudio?.pause();
      for (const [id, element] of mediaRef.current) if (element.tagName === "VIDEO") { element.pause(); if (element !== previewMedia.get(id)) element.onseeked = null; }
      mediaRef.current = previewMedia;
      exportGainsRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      await context?.close();
      setRendering(false);
      draw(timeRef.current);
    }
  };

  return <div className="h-full overflow-y-auto bg-[#0b0b11] px-3 pb-24 pt-4 text-white sm:px-6">
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft /></Button>
        <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">NaliBase Visualize</p><h1 className="text-2xl font-black sm:text-3xl">Music Video Lab</h1><p className="text-xs text-white/60">Import footage and a song. Edit the timeline, preview, then export a real video.</p></div>
        <Button variant="outline" onClick={() => travel("undo")} disabled={!historyRef.current.past.length || rendering} aria-label="Undo edit" title="Undo edit"><Undo2 size={16} /></Button>
        <Button variant="outline" onClick={() => travel("redo")} disabled={!historyRef.current.future.length || rendering} aria-label="Redo edit" title="Redo edit"><Redo2 size={16} /></Button>
        <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs text-white/70"><Save size={15} /> Saved on this device</span>
      </header>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_17rem]">
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><FolderOpen size={18} /> Project media</h2>
          <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-fuchsia-400/50 bg-fuchsia-400/5 text-sm hover:bg-fuchsia-400/10"><Upload size={20} className="mb-1" /> Import video, images or audio<input type="file" accept="video/*,image/*,audio/*" multiple className="sr-only" onChange={(event) => { importFiles([...event.target.files]); event.target.value = ""; }} /></label>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{assets.map((asset) => <div key={asset.id} className="flex items-center gap-2 rounded-lg border border-white/10 p-2"><Film size={15} className="shrink-0 text-fuchsia-300" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold" title={asset.name}>{asset.name}</p><p className="text-[11px] text-white/50">{asset.kind} · {formatTime(asset.duration)}</p></div><button onClick={() => addClip(asset)} aria-label={`Add ${asset.name} to timeline`} title="Add to timeline" className="rounded p-1 hover:bg-white/10"><Plus size={17}/></button><button onClick={() => removeAsset(asset)} aria-label={`Remove ${asset.name}`} title="Remove from project" className="rounded p-1 hover:bg-white/10"><Trash2 size={15}/></button></div>)}</div>
          {!assets.length && <p className="mt-3 text-xs text-white/50">Your imported files appear here. No sample media is inserted.</p>}
        </section>
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[.04] p-3">
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="aspect-video w-full rounded-xl bg-black" aria-label="Video preview" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={play} disabled={!length || rendering} aria-label={playing ? "Pause preview" : "Play preview"}>{playing ? <Pause size={16}/> : <Play size={16}/>}</Button>
            <span className="font-mono text-sm">{formatTime(time)} / {formatTime(length)}</span>
            <input aria-label="Playhead" type="range" min="0" max={Math.max(length, 0.1)} step=".01" value={Math.min(time, Math.max(length, .1))} onChange={(e) => seek(Number(e.target.value))} className="min-w-28 flex-1 accent-fuchsia-400" />
            <Button onClick={exportVideo} disabled={!length || rendering}><Film size={16} className="mr-2" />{rendering ? "Exporting..." : "Export WebM"}</Button>
            {output && <a href={output} download="nalibase-music-video.webm" className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-500 px-3 py-2 text-sm font-bold"><Download size={16} /> Download</a>}
          </div>
          <audio ref={audioRef} src={assets.find((asset) => asset.id === music?.assetId)?.url || undefined} preload="auto" />
          <p role="status" className="mt-2 min-h-5 text-xs text-white/65">{status}</p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
          <h2 className="mb-3 font-bold">Inspector</h2>
          <label className="block text-xs text-white/60">Video title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={55} placeholder="Optional title overlay" className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 p-2 text-white" /></label>
          {chosen && <div className="mt-4 space-y-3 border-t border-white/10 pt-4 text-xs">
            <p className="truncate font-bold">{selectedAsset?.name}</p>
            <label className="block">Start (seconds)<input type="number" min="0" step=".1" value={chosen.start} onChange={(e) => updateClip({ start: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 p-2" /></label>
            <label className="block">In point (seconds)<input type="number" min="0" max={chosen.out - .1} step=".1" value={chosen.in} onChange={(e) => setClips((current) => trimClip(current, selected, "left", chosen.start + Number(e.target.value) - chosen.in))} className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 p-2" /></label>
            <label className="block">Out point (seconds)<input type="number" min={chosen.in + .1} max={chosen.sourceDuration} step=".1" value={chosen.out} onChange={(e) => setClips((current) => trimClip(current, selected, "right", Number(e.target.value)))} className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 p-2" /></label>
            {selectedAsset?.kind === "video" && <label className="block">Clip volume: {Math.round((chosen.volume ?? 1) * 100)}%<input type="range" min="0" max="1" step=".01" value={chosen.volume ?? 1} onChange={(e) => updateClip({ volume: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>}
            {["brightness", "contrast", "saturation"].map((key) => <label key={key} className="block capitalize">{key}: {chosen[key]}%<input type="range" min="0" max="200" value={chosen[key]} onChange={(e) => updateClip({ [key]: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>)}
            <Button variant="outline" onClick={() => { setClips((current) => splitClip(current, selected, time)); setStatus("Split at playhead when it falls inside the selected clip."); }}><Scissors size={15} className="mr-2"/> Split at playhead</Button>
            <Button variant="destructive" onClick={() => { setClips((current) => current.filter((clip) => clip.id !== selected)); setSelected(null); }}><Trash2 size={15} className="mr-2"/> Delete clip</Button>
          </div>}
          {music && <div className="mt-4 border-t border-white/10 pt-3 text-xs"><p className="font-bold">Soundtrack: {assets.find((asset) => asset.id === music.assetId)?.name}</p><label className="mt-2 block">Volume {Math.round(music.volume * 100)}%<input type="range" min="0" max="1" step=".01" value={music.volume} onChange={(e) => { const volume = Number(e.target.value); setMusic({ ...music, volume }); if (audioRef.current) audioRef.current.volume = volume; }} className="w-full accent-fuchsia-400" /></label><button className="mt-2 text-rose-300" onClick={() => setMusic(null)}>Remove soundtrack</button></div>}
        </section>
      </div>
      <section className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Timeline · Video and soundtrack</h2><label className="text-xs">Zoom <input type="range" min="20" max="160" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="align-middle accent-fuchsia-400" /></label></div>
        <div className="overflow-x-auto"><div style={{ width: Math.max(700, length * zoom + 120) }} className="relative min-h-40 rounded-lg bg-black/40 p-2">
          <div className="ml-20 h-5 border-b border-white/10 font-mono text-[10px] text-white/40">{Array.from({ length: Math.ceil(Math.max(length, 10) / 5) + 1 }, (_, i) => <span key={i} className="absolute" style={{ left: 90 + i * 5 * zoom }}>{i * 5}s</span>)}</div>
          <div className="mt-2 flex h-16 items-center"><span className="w-20 shrink-0 text-xs text-white/50">VIDEO</span><div className="relative h-14 flex-1 rounded bg-white/5" onClick={(e) => { if (e.target === e.currentTarget) seek((e.nativeEvent.offsetX) / zoom); }}>{clips.map((clip) => <button key={clip.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", clip.id); }} onDragEnd={(e) => { const rail = e.currentTarget.parentElement.getBoundingClientRect(); setClips((current) => current.map((item) => item.id === clip.id ? { ...item, start: Math.max(0, Math.round((e.clientX - rail.left) / zoom * 10) / 10) } : item)); }} onClick={() => { setSelected(clip.id); seek(clip.start); }} style={{ left: clip.start * zoom, width: clipLength(clip) * zoom }} className={`absolute top-1 h-12 overflow-hidden rounded border px-2 text-left text-xs ${selected === clip.id ? "border-fuchsia-200 bg-fuchsia-600" : "border-fuchsia-500/70 bg-fuchsia-900"}`} title="Click to select; drag to move"><span className="block truncate font-bold">{assets.find((asset) => asset.id === clip.assetId)?.name}</span><span>{formatTime(clipLength(clip))}</span></button>)}</div></div>
          <div className="flex h-12 items-center"><span className="w-20 shrink-0 text-xs text-white/50">MUSIC</span><div className="h-9 flex-1 rounded bg-white/5">{music && <div style={{ width: Math.min(music.duration, length) * zoom }} className="h-full truncate rounded border border-cyan-500 bg-cyan-900 px-2 py-2 text-xs">{assets.find((asset) => asset.id === music.assetId)?.name}</div>}</div></div>
          <div className="pointer-events-none absolute top-5 bottom-2 w-px bg-white" style={{ left: 90 + time * zoom }} />
        </div></div>
        <p className="mt-2 text-xs text-white/50">Import your own media. Drag a video clip to move it; use the Inspector to trim, split, grade or delete it. Export plays in real time and mixes video clip audio with your imported soundtrack.</p>
      </section>
    </div>
  </div>;
}
