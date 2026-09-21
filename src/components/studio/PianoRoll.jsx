import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ArrowDown, ArrowUp, Magnet, Trash2, X } from 'lucide-react';

const ROW_H = 18;
const BEAT_W = 44;
const LOW = 36;
const HIGH = 84;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function PianoRoll({ track, onChange, onCommit, onClose, bars = 4 }) {
  const notes = track?.midiNotes || [];
  const [selected, setSelected] = useState(null);
  const [drag, setDrag] = useState(null);
  const [grid, setGrid] = useState(.25);
  const [quantizeStrength, setQuantizeStrength] = useState(100);
  const totalBeats = bars * 4;
  const pitches = useMemo(() => Array.from({ length: HIGH - LOW + 1 }, (_, i) => HIGH - i), []);
  const selectedNote = notes.find(n => n.id === selected);
  const audioCtxRef = useRef(null);
  const activeVoicesRef = useRef(new Set());

  const stopPreviewVoices = () => {
    activeVoicesRef.current.forEach(({ osc, gain }) => {
      try {
        const now = audioCtxRef.current?.currentTime || 0;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0.0001, now, 0.015);
        osc.stop(now + 0.08);
      } catch {}
    });
    activeVoicesRef.current.clear();
  };

  const previewNote = async (midi, velocity = 100) => {
    if (typeof window === 'undefined') return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = audioCtxRef.current || new AudioContextCtor();
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    stopPreviewVoices();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const now = ctx.currentTime;
    const level = Math.max(0.04, Math.min(0.35, (Number(velocity) || 100) / 127 * 0.3));
    osc.type = track?.instrument === 'bass' ? 'sine' : track?.instrument === 'piano' ? 'triangle' : 'sawtooth';
    osc.frequency.value = 440 * Math.pow(2, (Number(midi) - 69) / 12);
    filter.type = 'lowpass';
    filter.frequency.value = track?.instrument === 'bass' ? 650 : 3200;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (track?.instrument === 'piano' ? 0.7 : 0.45));
    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    const voice = { osc, gain };
    activeVoicesRef.current.add(voice);
    osc.onended = () => activeVoicesRef.current.delete(voice);
    osc.start(now); osc.stop(now + (track?.instrument === 'piano' ? 0.72 : 0.48));
  };

  useEffect(() => () => {
    stopPreviewVoices();
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }, []);

  const addNote = (e) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rawBeat = (e.clientX - rect.left) / BEAT_W;
    const startBeat = clamp(Math.floor(rawBeat / grid) * grid, 0, totalBeats - .25);
    const row = clamp(Math.floor((e.clientY - rect.top) / ROW_H), 0, pitches.length - 1);
    const note = { id: crypto.randomUUID(), note: pitches[row], startBeat, durationBeats: 1, velocity: 100 };
    onChange([...notes, note].sort((a,b) => a.startBeat - b.startBeat));
    setSelected(note.id);
    previewNote(note.note, note.velocity);
    queueMicrotask(() => onCommit?.());
  };

  const update = (patch) => onChange(notes.map(n => n.id === selected ? { ...n, ...patch } : n));
  const commitChange = (next) => { onChange(next); queueMicrotask(() => onCommit?.()); };
  const remove = () => { commitChange(notes.filter(n => n.id !== selected)); setSelected(null); };
  const quantize = () => commitChange(notes.map(n => {
    const target = Math.round(n.startBeat / grid) * grid;
    const startBeat = n.startBeat + (target - n.startBeat) * (quantizeStrength / 100);
    return { ...n, startBeat: clamp(Math.round(startBeat * 1000) / 1000, 0, Math.max(0, totalBeats - Math.max(.25, n.durationBeats || .25))) };
  }).sort((a,b) => a.startBeat - b.startBeat));
  const transpose = (semitones) => commitChange(notes.map(n => ({ ...n, note: clamp(n.note + semitones, LOW, HIGH) })));
  const normalizeVelocity = () => commitChange(notes.map(n => ({ ...n, velocity: 100 })));
  const shapeVelocity = (amount) => commitChange(notes.map(n => ({ ...n, velocity: clamp((n.velocity || 100) + amount, 1, 127) })));
  const humanize = () => commitChange(notes.map(n => ({
    ...n,
    startBeat: clamp(Math.round((n.startBeat + (Math.random() - .5) * Math.min(grid * .35, .08)) * 1000) / 1000, 0, Math.max(0, totalBeats - Math.max(.25, n.durationBeats || .25))),
    velocity: clamp((n.velocity || 100) + Math.round((Math.random() - .5) * 12), 1, 127),
  })).sort((a,b) => a.startBeat - b.startBeat));

  const startDrag = (e, note, mode = 'move') => {
    e.preventDefault(); e.stopPropagation(); setSelected(note.id);
    setDrag({ id: note.id, mode, x: e.clientX, y: e.clientY, startBeat: note.startBeat, pitch: note.note, duration: note.durationBeats });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e) => {
    if (!drag) return;
    const dxBeats = Math.round(((e.clientX - drag.x) / BEAT_W) / grid) * grid;
    if (drag.mode === 'resize') {
      const maxDuration = Math.max(.25, totalBeats - drag.startBeat);
      const durationBeats = clamp(Math.round((drag.duration + dxBeats) / grid) * grid, Math.min(.25, grid), maxDuration);
      const current = notes.find(n => n.id === drag.id);
      if (current?.durationBeats === durationBeats) return;
      onChange(notes.map(n => n.id === drag.id ? { ...n, durationBeats } : n));
    } else {
      const dyNotes = Math.round((e.clientY - drag.y) / ROW_H);
      const dragged = notes.find(n => n.id === drag.id);
      const duration = Math.max(.25, dragged?.durationBeats || drag.duration || .25);
      const startBeat = clamp(drag.startBeat + dxBeats, 0, Math.max(0, totalBeats - duration));
      const note = clamp(drag.pitch - dyNotes, LOW, HIGH);
      if (dragged?.startBeat === startBeat && dragged?.note === note) return;
      onChange(notes.map(n => n.id === drag.id ? { ...n, startBeat, note } : n));
    }
  };
  const endDrag = () => { if (drag) onCommit?.(); setDrag(null); };

  return <div className="border-t border-border bg-card/95">
    <div className="h-10 px-3 flex items-center gap-3 border-b border-border">
      <strong className="text-xs">Piano Roll — {track?.name}</strong>
      <span className="text-[10px] text-muted-foreground">{notes.length} notes · {grid === 1 ? '1/4' : grid === .5 ? '1/8' : grid === .25 ? '1/16' : '1/32'} grid</span>
      <div className="ml-auto flex items-center gap-1">
        <select value={grid} onChange={e=>setGrid(Number(e.target.value))} className="h-7 rounded border border-border bg-background px-1 text-[10px]" title="MIDI grid resolution">
          <option value={1}>1/4</option><option value={.5}>1/8</option><option value={.25}>1/16</option><option value={.125}>1/32</option>
        </select>
        <select value={quantizeStrength} onChange={e=>setQuantizeStrength(Number(e.target.value))} className="h-7 rounded border border-border bg-background px-1 text-[10px]" title="Quantize strength">
          <option value={25}>25%</option><option value={50}>50%</option><option value={75}>75%</option><option value={100}>100%</option>
        </select>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" title="Quantize all notes to the selected grid and strength" onClick={quantize}><Magnet className="w-3.5 h-3.5 mr-1"/>Quantize</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" title="Transpose down one octave" onClick={()=>transpose(-12)}>-12</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" title="Transpose all notes down one semitone" onClick={()=>transpose(-1)}><ArrowDown className="w-3.5 h-3.5"/></Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" title="Transpose all notes up one semitone" onClick={()=>transpose(1)}><ArrowUp className="w-3.5 h-3.5"/></Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" title="Transpose up one octave" onClick={()=>transpose(12)}>+12</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" title="Reduce all velocities by 5" onClick={()=>shapeVelocity(-5)}>Vel−</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" title="Set all note velocities to 100" onClick={normalizeVelocity}>100</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" title="Increase all velocities by 5" onClick={()=>shapeVelocity(5)}>Vel+</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" title="Add subtle timing and velocity variation" onClick={humanize}>Humanize</Button>
        {selectedNote && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={remove}><Trash2 className="w-3.5 h-3.5"/></Button>}
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onClose}><X className="w-3.5 h-3.5"/></Button>
      </div>
    </div>
    <div className="flex h-64">
      <div className="w-12 shrink-0 overflow-hidden border-r border-border bg-background" aria-label="Piano keyboard">
        {pitches.map(p => {
          const black = [1,3,6,8,10].includes(p % 12);
          return <button key={p} type="button" aria-label={`Play MIDI note ${p}`} title={`Play MIDI note ${p}`} onPointerDown={() => previewNote(p)} onPointerUp={stopPreviewVoices} onPointerCancel={stopPreviewVoices} onPointerLeave={stopPreviewVoices} className={`block w-full h-[18px] px-1 text-[8px] text-left border-b border-border/30 active:bg-primary active:text-primary-foreground ${black ? 'bg-foreground/80 text-background' : 'bg-background text-muted-foreground'}`}>{p % 12 === 0 ? `C${Math.floor(p/12)-1}` : ''}</button>;
        })}
      </div>
      <div className="overflow-auto flex-1">
        <div onDoubleClick={addNote} className="relative cursor-crosshair" style={{ width: totalBeats * BEAT_W, height: pitches.length * ROW_H, backgroundSize: `${BEAT_W/4}px ${ROW_H}px`, backgroundImage: 'linear-gradient(to right, hsl(var(--border)/.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)/.25) 1px, transparent 1px)' }}>
          {notes.map(n => <div key={n.id} onPointerDown={e=>startDrag(e,n)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className={`absolute rounded-sm border text-[8px] text-left px-1 overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing ${selected===n.id?'bg-primary border-primary-foreground ring-1 ring-primary':'bg-primary/70 border-primary'}`} style={{ left:n.startBeat*BEAT_W, top:(HIGH-n.note)*ROW_H+1, width:Math.max(8,n.durationBeats*BEAT_W), height:ROW_H-2 }}>
            {n.note}<span onPointerDown={e=>startDrag(e,n,'resize')} className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-foreground/20" />
          </div>)}
        </div>
      </div>
    </div>
    <div className="h-20 border-t border-border bg-background/70 flex">
      <div className="w-12 shrink-0 border-r border-border px-1 py-1 text-[8px] text-muted-foreground">VEL<br/>127<br/><span className="opacity-60">1</span></div>
      <div className="relative overflow-hidden flex-1" style={{ minWidth: totalBeats * BEAT_W }}>
        {notes.map(n => <button key={`vel-${n.id}`} type="button" title={`Velocity ${n.velocity || 100}`} onClick={()=>setSelected(n.id)} className={`absolute bottom-0 w-2 rounded-t-sm ${selected===n.id?'bg-primary':'bg-primary/55'}`} style={{ left:n.startBeat*BEAT_W + Math.max(0, Math.min(n.durationBeats*BEAT_W/2 - 4, 8)), height:`${Math.max(3, ((n.velocity || 100) / 127) * 72)}px` }} />)}
      </div>
    </div>
    {selectedNote && <div className="h-12 px-3 border-t border-border flex items-center gap-4 text-[10px]">
      <span>Velocity {selectedNote.velocity}</span><Slider className="w-28" min={1} max={127} step={1} value={[selectedNote.velocity]} onValueChange={v=>update({velocity:v[0]})} onValueCommit={()=>onCommit?.()}/>
      <span>Length</span><Slider className="w-28" min={.25} max={8} step={.25} value={[selectedNote.durationBeats]} onValueChange={v=>update({durationBeats:v[0]})} onValueCommit={()=>onCommit?.()}/>
      <span>Start {selectedNote.startBeat.toFixed(2)} beats</span>
    </div>}
  </div>;
}
