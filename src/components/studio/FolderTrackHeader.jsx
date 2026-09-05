import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GripVertical, Settings2, ChevronDown, ChevronRight, PenTool, Copy, Trash2, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

const FOLDER_COLORS = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-pink-500', 'bg-orange-500', 'bg-cyan-500'];

/**
 * Pro Tools-style Folder Track header.
 * A folder track is a collapsible container that groups tracks visually.
 * When collapsed, its member tracks are hidden from the timeline.
 */
export default function FolderTrackHeader({
  track, index, isRecording, selectedTrackIds,
  dragProvided, dragSnapshot,
  handleTrackClick, setTracksWithHistory,
  pushToHistory, tracksRef,
  setRenamingTrack, setNewTrackName,
  duplicateTrack, deleteTrack,
  allTracks,
  toggleFolderCollapse,
}) {
  const members = (track.folderMembers || []).map(id => allTracks.find(t => t.id === id)).filter(Boolean);
  const collapsed = track.collapsed;

  const toggleMember = (memberId) => {
    setTracksWithHistory(prev => prev.map(t => {
      if (t.id !== track.id) return t;
      const current = t.folderMembers || [];
      const isMember = current.includes(memberId);
      return {
        ...t,
        folderMembers: isMember ? current.filter(id => id !== memberId) : [...current, memberId],
      };
    }));
  };

  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      onClick={(e) => handleTrackClick(e, track.id)}
      style={{ ...dragProvided.draggableProps.style, height: '48px' }}
      className={cn(
        "border-b border-border/40 px-3 flex items-center transition-none cursor-pointer border-l-4 relative group/header",
        "bg-secondary/60 border-l-primary/60",
        selectedTrackIds.includes(track.id) && "border-l-primary bg-primary/20",
        dragSnapshot.isDragging && "shadow-xl ring-1 ring-primary/40",
      )}
    >
      <span
        {...dragProvided.dragHandleProps}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 -ml-1 mr-1 p-0.5 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>

      {/* Collapse toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleFolderCollapse(track.id); }}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        title={collapsed ? "Expand folder" : "Collapse folder"}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <div className={cn("w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[10px] mr-2", track.color || 'bg-primary', "text-white")}>
        <Folder className="w-3 h-3" />
      </div>

      <span className="truncate text-xs font-semibold text-foreground/90 mr-2" title={track.name}>{track.name}</span>
      <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0 mr-2">FOLDER</span>
      <span className="text-[9px] text-muted-foreground font-mono">{members.length} track{members.length !== 1 ? 's' : ''}</span>

      {members.length > 0 && !collapsed && (
        <div className="flex flex-wrap gap-1 ml-3 flex-1 overflow-hidden">
          {members.slice(0, 6).map(m => (
            <span key={m.id} className="text-[8px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/40 truncate max-w-[70px]">
              {m.name}
            </span>
          ))}
          {members.length > 6 && <span className="text-[8px] text-muted-foreground">+{members.length - 6}</span>}
        </div>
      )}

      <div className="flex items-center gap-0.5 shrink-0 ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="Folder Options" onClick={(e) => e.stopPropagation()} className="w-6 h-6 text-muted-foreground hover:text-foreground">
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => { setRenamingTrack({ ...track, isNew: false }); setNewTrackName(track.name); }}>
              <PenTool className="w-4 h-4 mr-2" /> Rename Folder
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggleFolderCollapse(track.id)}>
              {collapsed ? <><ChevronDown className="w-4 h-4 mr-2" /> Expand</> : <><ChevronRight className="w-4 h-4 mr-2" /> Collapse</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground mb-1.5 font-semibold">Add Tracks to Folder</div>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                {allTracks.filter(t => t.id !== track.id && t.trackType !== 'vca' && t.trackType !== 'folder').map(t => (
                  <button
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); toggleMember(t.id); }}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors",
                      (track.folderMembers || []).includes(t.id) ? "bg-primary/20 text-primary" : "hover:bg-secondary text-muted-foreground"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full", (track.folderMembers || []).includes(t.id) ? "bg-primary" : "bg-muted-foreground/30")} />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
                {allTracks.filter(t => t.id !== track.id && t.trackType !== 'vca' && t.trackType !== 'folder').length === 0 && (
                  <div className="text-[10px] text-muted-foreground italic px-2 py-1">No audio tracks available</div>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5">Folder Color</div>
              <div className="flex gap-1.5 flex-wrap">
                {FOLDER_COLORS.map(color => (
                  <button key={color} onClick={(e) => { e.stopPropagation(); setTracksWithHistory(prev => prev.map(t => t.id === track.id ? { ...t, color } : t)); }} className={cn('w-5 h-5 rounded-md transition-all hover:scale-110', color, track.color === color && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} />
                ))}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => duplicateTrack(track)}>
              <Copy className="w-4 h-4 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => deleteTrack(track.id)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}