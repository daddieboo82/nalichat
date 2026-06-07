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
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Stop</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Enter</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Record</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">R</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Add Track</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+N</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Shuffle Mode</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+1</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Slip Mode</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+2</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Grid Mode</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+3</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Undo</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+Z</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Redo</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+Y</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Split Clip</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+E</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Duplicate Clip</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+D</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Delete Clip</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Del</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Lock/Unlock</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">L</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Solo Selected</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+S</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Mute Selected</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Shift+M</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Return to Zero</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Home</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Fast-forward</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Right Arrow</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Rewind</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Left Arrow</span></div>
            <div className="col-span-2 mt-2 font-semibold">Tools</div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Trim Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">T</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Cut Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">C</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Grabber Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">G</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Fade Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">F</span></div>
            <div className="flex justify-between items-center bg-secondary/50 p-2 rounded"><span className="text-muted-foreground">Smart Tool</span><span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">E</span></div>
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t border-border">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}