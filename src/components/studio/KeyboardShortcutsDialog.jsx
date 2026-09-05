import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function KeyboardShortcutsDialog({ open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-card border-border text-foreground z-[200] shadow-2xl p-4 data-[state=closed]:duration-200 data-[state=open]:duration-300">
        <SheetHeader className="mb-4">
          <SheetTitle>Keyboard Shortcuts</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Play / Pause</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Space</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Stop</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Numpad 0</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Record</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">R</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Add Track</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+N</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Shuffle Mode</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+1</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Slip Mode</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+2</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Grid Mode</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+3</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Spot Mode</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+4</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Metronome</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">7</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Undo</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+Z</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Redo</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+Y</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Split Clip</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+E</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Duplicate Clip</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+D</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Delete Clip</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Del</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Lock/Unlock</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">L</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Solo Selected</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+S</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Mute Selected</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+M</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Return to Zero</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Home</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Add Marker</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">M</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Tab to Transient</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Tab</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Prev Transient</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+Tab</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Set In Point</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">I</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Set Out Point</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">O</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Select All</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">A</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Clear Selection</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Esc</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Nudge Forward</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+→</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Nudge Backward</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+←</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Fast-forward</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Right Arrow</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Rewind</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Left Arrow</span></div>
            <div className="col-span-2 mt-2 font-semibold">Workspace & Windows</div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Zoom In/Out</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+Scroll</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Wave Editor</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+W</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Split Stems</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+E</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Toggle Loop</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+L</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Generate Melody</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+G</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Heal Split</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">H</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Repeat Clip ×2</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+R</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Group Tracks</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+G</span></div>
            <div className="col-span-2 mt-2 font-semibold">Tools</div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Trim Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">T</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Cut Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">C</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Grabber Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">G</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Fade Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">F</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Smart Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">E</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Scrub Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">S</span></div>
            <div className="col-span-2 mt-2 font-semibold">Pro Tools Features</div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Clip Gain Line</strong> — Select Smart or Trim tool, then drag the yellow dashed line on any clip to adjust gain (±12 dB).
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Spot Mode</strong> — Select Spot mode (Shift+4), then click any clip to type an exact timecode position.
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Pre/Post-roll</strong> — Set pre-roll and post-roll seconds in the transport bar for punch-in recording with context.
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Selection Region</strong> — Press I at the playhead to set an in-point, O for out-point. The highlighted region is used for loop playback and edit operations.
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Hide Track</strong> — Right-click a track header → Hide Track to declutter the timeline without deleting.
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Heal Split</strong> — Rejoin two clips that were split from the same source. Select a clip and press H.
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Repeat Clip</strong> — Quickly duplicate a clip end-to-end (×2 or ×4) from the track options menu or Shift+R.
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Crossfades</strong> — When two clips on the same track overlap or touch, a crossfade zone with an × indicator appears automatically for seamless transitions.
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Pan Automation</strong> — Click the VOL AUTO label in the automation lane to toggle to PAN AUTO. Top = Left, center = Center, bottom = Right.
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Capture Selection → Loop</strong> — Set in/out points (I/O), then click the crosshair button to instantly loop that region.
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Punch-in Recording</strong> — With a selection active, recording auto-stops at the out-point for precise punch-ins.
            </div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 p-2 rounded text-[10px] text-muted-foreground">
              <strong className="text-primary">Track Groups</strong> — Select multiple tracks (Ctrl+click), then Ctrl+G to group them for synchronized editing.
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t border-border">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}