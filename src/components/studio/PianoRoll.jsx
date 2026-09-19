import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ArrowDown, ArrowUp, Magnet, Trash2, X } from 'lucide-react';

const ROW_H = 18;
const BEAT_W = 44;
const LOW = 36;
const HIGH = 84;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function PianoRoll({ track, onChange, onClose, bars = 4 }) {
  const notes = track?.midiNotes || [];
  const [selected, setSelected] = useState(null);
  const [drag, setDrag] = useState(null);
  const totalBeats = bars * 4;
  const pitches = useMemo(() => Array.from({ length: HIGH - LOW + 1 }, (_, i) => HIGH - i), []);
  const selectedNote = notes.find(n => n.id === selected);

  const addNote = (e) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const startBeat = clamp(Math.floor(((e.clientX - rect.left) / BEAT_W) * 4) / 4, 0, totalBeats - .25);
    const row = clamp(Math.floor((e.clientY - rect.top) / ROW_H), 0, pitches.length - 1);
    const note = { id: crypto.randomUUID(), note: pitches[row], startBeat, durationBeats: 1, velocity: 100 };
    onChange([...notes, note].sort((a,b) => a.startBeat - b.startBeat));
    setSelected(note.id);
  };

  const update = (patch) => onChange(notes.map(n => n.id === selected ? { ...n, ...patch } : n));
  const remove = () => { onChange(notes.filter(n => n.id !== selected)); setSelected(null); };
  const quantize = () => onChange(notes.map(n => ({ ...n, startBeat: clamp(Math.round(n.startBeat * 4) / 4, 0, Math.max(0, totalBeats - Math.max(.25, n.durationBeats || .25))) })).sort((a,b) => a.startBeat - b.startBeat));
  const transpose = (semitones) => onChange(notes.map(n => ({ ...n, note: clamp(n.note + semitones, LOW, HIGH) })));
  const normalizeVelocity = () => onChange(notes.map(n => ({ ...n, velocity: 100 })));

  const startDrag = (e, note, mode = 'move') => {
    e.preventDefault(); e.stopPropagation(); setSelected(note.id);
    setDrag({ id: note.id, mode, x: e.clientX, y: e.clientY, startBeat: note.startBeat, pitch: note.note, duration: note.durationBeats });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e) => {
    if (!drag) return;
    const dxBeats = Math.round(((e.clientX - drag.x) / BEAT_W) * 4) / 4;
    if (drag.mode === 'resize') {
      const maxDuration = Math.max(.25, totalBeats - drag.startBeat);
      const durationBeats = clamp(Math.round((drag.duration + dxBeats) * 4) / 4, .25, maxDuration);
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
  const endDrag = () => setDrag(null);

  return <div className="border-t border-border bg-card/95">
    <div className="h-10 px-3 flex items-center gap-3 border-b border-border">
      <strong className="text-xs">Piano Roll — {track?.name}</strong>
      <span className="text-[10px] text-muted-foreground">{notes.length} notes · 1/16 grid</span>
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" title="Quantize all notes to the 1/16 grid" onClick={quantize}><Magnet className="w-3.5 h-3.5 mr-1"/>Quantize</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" title="Transpose all notes down one semitone" onClick={()=>transpose(-1)}><ArrowDown className="w-3.5 h-3.5"/></Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" title="Transpose all notes up one semitone" onClick={()=>transpose(1)}><ArrowUp className="w-3.5 h-3.5"/></Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" title="Set all note velocities to 100" onClick={normalizeVelocity}>Vel 100</Button>
        {selectedNote && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={remove}><Trash2 className="w-3.5 h-3.5"/></Button>}
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onClose}><X className="w-3.5 h-3.5"/></Button>
      </div>
    </div>
    <div className="flex h-64">
      <div className="w-12 shrink-0 overflow-hidden border-r border-border bg-background">
        {pitches.map(p => <div key={p} className="h-[18px] px-1 text-[8px] text-muted-foreground border-b border-border/30">{p % 12 === 0 ? `C${Math.floor(p/12)-1}` : ''}</div>)}
      </div>
      <div className="overflow-auto flex-1">
        <div onDoubleClick={addNote} className="relative cursor-crosshair" style={{ width: totalBeats * BEAT_W, height: pitches.length * ROW_H, backgroundSize: `${BEAT_W/4}px ${ROW_H}px`, backgroundImage: 'linear-gradient(to right, hsl(var(--border)/.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)/.25) 1px, transparent 1px)' }}>
          {notes.map(n => <div key={n.id} onPointerDown={e=>startDrag(e,n)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className={`absolute rounded-sm border text-[8px] text-left px-1 overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing ${selected===n.id?'bg-primary border-primary-foreground ring-1 ring-primary':'bg-primary/70 border-primary'}`} style={{ left:n.startBeat*BEAT_W, top:(HIGH-n.note)*ROW_H+1, width:Math.max(8,n.durationBeats*BEAT_W), height:ROW_H-2 }}>
            {n.note}<span onPointerDown={e=>startDrag(e,n,'resize')} className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-foreground/20" />
          </div>)}
        </div>
      </div>
    </div>
    {selectedNote && <div className="h-12 px-3 border-t border-border flex items-center gap-4 text-[10px]">
      <span>Velocity {selectedNote.velocity}</span><Slider className="w-28" min={1} max={127} step={1} value={[selectedNote.velocity]} onValueChange={v=>update({velocity:v[0]})}/>
      <span>Length</span><Slider className="w-28" min={.25} max={8} step={.25} value={[selectedNote.durationBeats]} onValueChange={v=>update({durationBeats:v[0]})}/>
      <span>Start {selectedNote.startBeat.toFixed(2)} beats</span>
    </div>}
  </div>;
}
