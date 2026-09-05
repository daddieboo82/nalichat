import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/responsive-select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GripVertical, Settings2, Activity, TrendingUp, PenTool, Eye, EyeOff, Link2, Repeat, Users, Palette, Copy, Trash2, Circle, Volume2, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TRACK_COLORS = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-pink-500', 'bg-red-500', 'bg-orange-500', 'bg-cyan-500'];

export default function TrackHeader({
  track, index, isRecording, selectedTrackIds,
  dragProvided, dragSnapshot,
  handleTrackClick, setTracksWithHistory, toggleTrackProperty,
  toggleMute, toggleSolo, toggleArm,
  updateVolume, pushToHistory, tracksRef,
  setRenamingTrack, setNewTrackName,
  handleHealSplit, handleRepeatClip, handleToggleGroup,
  duplicateTrack, deleteTrack,
  setSelectedTrackIds, setShowBeatDetective, setShowCommitDialog,
}) {
  const inputType = track.inputType || ((track.name || "").toLowerCase().includes("beat") || (track.name || "").toLowerCase().includes("instrumental") ? "Internal Audio" : "In: Default Mic");

  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      onClick={(e) => handleTrackClick(e, track.id)}
      style={{ ...dragProvided.draggableProps.style, height: track.height ? `${track.height}px` : (track.showAutomation ? '176px' : '112px') }}
      className={cn(
        "border-b border-border/40 p-3 flex flex-col justify-between transition-none cursor-pointer border-l-4 relative group/header",
        track.muted ? "bg-card/30 opacity-70" : "bg-card/80 hover:bg-secondary/40",
        selectedTrackIds.includes(track.id) ? "border-l-primary bg-primary/20 shadow-[inset_0_0_30px_hsl(var(--primary)/0.15)]" : (track.groupId ? "border-l-accent" : "border-l-transparent"),
        dragSnapshot.isDragging && "shadow-xl ring-1 ring-primary/40 bg-secondary/60"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center mr-2">
          <span
            {...dragProvided.dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 -ml-1 mr-1 p-0.5 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
            title="Drag to reorder track"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 font-medium text-sm">
              <div className={cn("w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold shadow-sm", track.muted ? "bg-muted-foreground/30 text-muted-foreground" : `${track.color} text-white`)}>
                {index + 1}
              </div>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="truncate max-w-[100px] sm:max-w-none sm:whitespace-pre-wrap sm:break-words text-xs font-semibold cursor-help" title={track.name}>{track.name}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] break-words">{track.name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {track.groupId && (
                <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 shrink-0" title={`Group: ${track.groupId}`}>GRP</span>
              )}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Select value={inputType} onValueChange={(val) => setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, inputType: val } : t))}>
                <SelectTrigger className={cn("h-4 p-0 border-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 shadow-none font-mono text-[9px] w-max min-w-[120px] max-w-[160px] truncate flex items-center justify-between gap-0.5 [&>svg]:w-2.5 [&>svg]:h-2.5 m-0 mt-0.5 outline-none transition-colors", inputType !== "Internal Audio" ? "text-primary hover:text-primary/80 font-bold" : "text-muted-foreground hover:text-foreground")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="In: Default Mic">In: Default Mic</SelectItem>
                  <SelectItem value="In: Audio Interface">In: Audio Interface</SelectItem>
                  <SelectItem value="In: MIDI Keyboard">In: MIDI Keyboard</SelectItem>
                  <SelectItem value="Internal Audio">Internal Audio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleTrackProperty(track.id, 'elasticAudio') }} className={cn("hidden lg:flex h-6 px-1.5 gap-1 text-muted-foreground hover:text-foreground", track.elasticAudio && "text-primary")}><Activity className="w-3 h-3" /><span className="text-[9px]">Warp</span></Button></TooltipTrigger><TooltipContent side="top" className="text-xs">Elastic Audio</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleTrackProperty(track.id, 'showAutomation') }} className={cn("hidden xl:flex h-6 px-1.5 gap-1 text-muted-foreground hover:text-foreground", track.showAutomation && "text-primary")}><TrendingUp className="w-3 h-3" /><span className="text-[9px]">Auto</span></Button></TooltipTrigger><TooltipContent side="top" className="text-xs">Show Automation</TooltipContent></Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Track Options" onClick={(e) => e.stopPropagation()} className="w-6 h-6 text-muted-foreground hover:text-foreground"><Settings2 className="w-3.5 h-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => { setRenamingTrack({ ...track, isNew: false }); setNewTrackName(track.name); }}>
                <PenTool className="w-4 h-4 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, hidden: !t.hidden } : t))}>
                {track.hidden ? <><Eye className="w-4 h-4 mr-2" /> Show Track</> : <><EyeOff className="w-4 h-4 mr-2" /> Hide Track</>}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleHealSplit(track)}>
                <Link2 className="w-4 h-4 mr-2" /> Heal Split
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleRepeatClip(track, 2)}>
                <Repeat className="w-4 h-4 mr-2" /> Repeat Clip ×2
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleRepeatClip(track, 4)}>
                <Repeat className="w-4 h-4 mr-2" /> Repeat Clip ×4
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleToggleGroup(track)}>
                <Users className="w-4 h-4 mr-2" /> {track.groupId ? 'Ungroup' : 'Group Selected'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { setSelectedTrackIds([track.id]); setShowBeatDetective(true); }}>
                <Activity className="w-4 h-4 mr-2" /> Beat Detective
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { setSelectedTrackIds([track.id]); setShowCommitDialog(true); }} disabled={!track.audioUrl}>
                <Snowflake className="w-4 h-4 mr-2" /> Commit Track
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5"><Palette className="w-3 h-3" /> Track Color</div>
                <div className="flex gap-1.5 flex-wrap">
                  {TRACK_COLORS.map(color => (
                    <button key={color} onClick={(e) => { e.stopPropagation(); setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, color } : t)); }} className={cn('w-5 h-5 rounded-md transition-all hover:scale-110', color, track.color === color && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} aria-label={`Set track color to ${color}`} />
                  ))}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => duplicateTrack(track)}>
                <Copy className="w-4 h-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => deleteTrack(track.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <TooltipProvider delayDuration={200}>
          <Tooltip><TooltipTrigger asChild>
            <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
              <button onClick={() => toggleMute(track.id)} className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all border", track.muted ? "bg-red-500 text-white border-red-500" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground")}>M</button>
            </div>
          </TooltipTrigger><TooltipContent side="top" className="text-xs flex items-center gap-1">Mute Track <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+M</kbd></TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
              <button onClick={() => toggleSolo(track.id)} className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all border", track.solo ? "bg-yellow-500 text-white border-yellow-500" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground")}>S</button>
            </div>
          </TooltipTrigger><TooltipContent side="top" className="text-xs flex items-center gap-1">Solo Track <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+S</kbd></TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
              <button onClick={() => { if (inputType === 'Internal Audio') { toast.error("Cannot arm a track set to Internal Audio"); return; } toggleArm(track.id); }} className={cn("px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center justify-center border focus:outline-none", track.armed ? "bg-red-500 text-white border-red-500" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground", inputType === 'Internal Audio' && "opacity-30 cursor-not-allowed")}>
                <Circle className="w-3 h-3 fill-current" />
              </button>
            </div>
          </TooltipTrigger><TooltipContent side="top" className="text-xs">Arm for Recording</TooltipContent></Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <Slider value={[track.volume]} max={100} step={1} onValueChange={(val) => updateVolume(track.id, val)} onValueCommit={() => pushToHistory(tracksRef.current)} className="flex-1" />
      </div>

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-primary/50 z-30 opacity-0 group-hover/header:opacity-100 transition-opacity"
        title="Adjust track height"
        onPointerDown={(e) => {
          e.stopPropagation();
          const startY = e.clientY;
          const startHeight = track.height || (track.showAutomation ? 176 : 112);
          const handleMove = (moveEvent) => {
            const newHeight = Math.max(64, Math.min(400, startHeight + (moveEvent.clientY - startY)));
            setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, height: newHeight } : t));
          };
          const handleUp = () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
          window.addEventListener('pointermove', handleMove);
          window.addEventListener('pointerup', handleUp);
        }}
      />
    </div>
  );
}