import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GripVertical, Settings2, Volume2, PenTool, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pro Tools-style VCA Master Track header.
 * A VCA track has a volume fader that scales the volume of its assigned member tracks.
 * It has no waveform — just a fader, member count, and assignment controls.
 */
export default function VcaTrackHeader({
  track, index, isRecording, selectedTrackIds,
  dragProvided, dragSnapshot,
  handleTrackClick, setTracksWithHistory,
  pushToHistory, tracksRef,
  setRenamingTrack, setNewTrackName,
  duplicateTrack, deleteTrack,
  allTracks,
}) {
  const members = (track.vcaMembers || []).map(id => allTracks.find(t => t.id === id)).filter(Boolean);

  const handleVolumeChange = (val) => {
    const vcaVolume = val[0];
    // Scale each member track's volume proportionally
    setTracksWithHistory(prev => prev.map(t => {
      if (t.id === track.id) return { ...t, volume: vcaVolume };
      if ((track.vcaMembers || []).includes(t.id)) {
        // VCA acts as a multiplier: member volume = original * (vcaVolume / 100)
        // We store the VCA scaling factor and apply it during playback
        return { ...t, vcaScale: vcaVolume / 100 };
      }
      return t;
    }));
  };

  const toggleMember = (memberId) => {
    setTracksWithHistory(prev => prev.map(t => {
      if (t.id !== track.id) return t;
      const current = t.vcaMembers || [];
      const isMember = current.includes(memberId);
      return {
        ...t,
        vcaMembers: isMember ? current.filter(id => id !== memberId) : [...current, memberId],
      };
    }));
  };

  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      onClick={(e) => handleTrackClick(e, track.id)}
      style={{ ...dragProvided.draggableProps.style, height: '96px' }}
      className={cn(
        "border-b border-border/40 p-3 flex flex-col justify-between transition-none cursor-pointer border-l-4 relative group/header",
        "bg-accent/10 border-l-accent",
        selectedTrackIds.includes(track.id) && "border-l-primary bg-primary/20 shadow-[inset_0_0_30px_hsl(var(--primary)/0.15)]",
        dragSnapshot.isDragging && "shadow-xl ring-1 ring-accent/40",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center mr-2">
          <span
            {...dragProvided.dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 -ml-1 mr-1 p-0.5 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 font-medium text-sm">
              <div className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold shadow-sm bg-accent text-white">
                V
              </div>
              <span className="truncate max-w-[100px] sm:max-w-none text-xs font-semibold text-accent" title={track.name}>{track.name}</span>
              <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 shrink-0">VCA</span>
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="VCA Options" onClick={(e) => e.stopPropagation()} className="w-6 h-6 text-muted-foreground hover:text-foreground">
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => { setRenamingTrack({ ...track, isNew: false }); setNewTrackName(track.name); }}>
                <PenTool className="w-4 h-4 mr-2" /> Rename VCA
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <div className="text-[10px] text-muted-foreground mb-1.5 font-semibold">Assign Tracks to VCA</div>
                <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                  {allTracks.filter(t => t.id !== track.id && t.trackType !== 'vca' && t.trackType !== 'folder').map(t => (
                    <button
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); toggleMember(t.id); }}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors",
                        (track.vcaMembers || []).includes(t.id) ? "bg-accent/20 text-accent" : "hover:bg-secondary text-muted-foreground"
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full", (track.vcaMembers || []).includes(t.id) ? "bg-accent" : "bg-muted-foreground/30")} />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                  {allTracks.filter(t => t.id !== track.id && t.trackType !== 'vca' && t.trackType !== 'folder').length === 0 && (
                    <div className="text-[10px] text-muted-foreground italic px-2 py-1">No audio tracks available</div>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => duplicateTrack(track)}>
                <Copy className="w-4 h-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => deleteTrack(track.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete VCA
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <Volume2 className="w-3.5 h-3.5 text-accent shrink-0" />
        <Slider
          value={[track.volume ?? 100]}
          max={100}
          step={1}
          onValueChange={handleVolumeChange}
          onValueCommit={() => pushToHistory(tracksRef.current)}
          className="flex-1"
        />
        <span className="text-[9px] font-mono text-accent w-8 text-right">{track.volume ?? 100}%</span>
      </div>

      {/* Member track chips */}
      {members.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {members.slice(0, 4).map(m => (
            <span key={m.id} className="text-[8px] px-1.5 py-0.5 rounded bg-accent/10 text-accent/80 border border-accent/20 truncate max-w-[80px]">
              {m.name}
            </span>
          ))}
          {members.length > 4 && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-accent/10 text-accent/80">+{members.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}