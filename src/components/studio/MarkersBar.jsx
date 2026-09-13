import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Flag, Plus, X } from 'lucide-react';
import { sounds } from '@/hooks/use-sound';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

/**
 * Pro Tools-style Markers / Memory Locations bar.
 * Shows markers on the timeline and lets users add/navigate/delete them.
 * Markers are stored in localStorage per project.
 */
export default function MarkersBar({ projectId, currentTime, onSeek, zoom, duration }) {
  const { user } = useAuth();
  const [markers, setMarkers] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [markerName, setMarkerName] = useState('');

  const storageKey = user?.id ? `nalistudio_markers_${user.id}_${projectId || 'local'}` : null;

  useEffect(() => {
    setMarkers([]);
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setMarkers(JSON.parse(saved));
    } catch (error) {
      console.error("Failed to restore Studio markers", error);
      toast.error("Couldn't restore saved markers on this device.");
    }
  }, [storageKey]);

  const saveMarkers = useCallback((next) => {
    setMarkers(next);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (error) {
      console.error("Failed to persist Studio markers", error);
      toast.error("Marker updated for this session, but couldn't be saved on this device.");
    }
  }, [storageKey]);

  const addMarker = () => {
    const name = markerName.trim() || `Marker ${markers.length + 1}`;
    const next = [...markers, { id: Date.now(), time: currentTime, name }].sort((a, b) => a.time - b.time);
    saveMarkers(next);
    setMarkerName('');
    setShowInput(false);
    sounds.success();
  };

  const deleteMarker = (id) => {
    saveMarkers(markers.filter(m => m.id !== id));
    sounds.click();
  };

  const goToMarker = (time) => {
    onSeek(time);
    sounds.nav();
  };

  // Listen for the keyboard shortcut to add a marker at the playhead
  useEffect(() => {
    const handler = () => setShowInput(true);
    window.addEventListener('studio-add-marker', handler);
    return () => window.removeEventListener('studio-add-marker', handler);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 bg-white/[0.02] shrink-0 min-h-[2rem]">
      <div className="flex items-center gap-1.5 shrink-0">
        <Flag className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline">Markers</span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
        {markers.length === 0 && !showInput && (
          <span className="text-[10px] text-muted-foreground/50 italic">No markers yet — press M or + to add one at the playhead</span>
        )}
        {markers.map(m => (
          <div
            key={m.id}
            className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-md px-2 py-1 shrink-0 group hover:bg-primary/20 transition-colors cursor-pointer"
            onClick={() => goToMarker(m.time)}
          >
            <Flag className="w-2.5 h-2.5 text-primary fill-current shrink-0" />
            <span className="text-[10px] font-medium text-foreground truncate max-w-[120px]">{m.name}</span>
            <span className="text-[9px] font-mono text-muted-foreground">{formatShort(m.time)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); deleteMarker(m.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
              aria-label="Delete marker"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {showInput ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Input
            value={markerName}
            onChange={(e) => setMarkerName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addMarker(); if (e.key === 'Escape') setShowInput(false); }}
            placeholder="Marker name..."
            className="h-7 w-32 text-xs"
            autoFocus
          />
          <Button size="sm" onClick={addMarker} className="h-7 px-2 text-xs">Add</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowInput(false)} className="h-7 px-2 text-xs">Cancel</Button>
        </div>
      ) : (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInput(true)}
                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                aria-label="Add marker at playhead"
              >
                <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Add</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Add marker at playhead (M)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

function formatShort(seconds) {
  seconds = Math.max(0, seconds || 0);
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}