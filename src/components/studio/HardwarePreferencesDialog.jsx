import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HardwarePreferencesDialog({ open, onOpenChange, hardware }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground z-[200]">
        <DialogHeader>
          <DialogTitle>Hardware Preferences</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 text-sm">
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Audio Input Device</span>
            <select className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-xs text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
              <option>System Default</option>
              {hardware.interface && <option>USB Audio Interface</option>}
              {hardware.mic && <option>Built-in Microphone</option>}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Audio Output Device</span>
            <select className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-xs text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
              <option>System Default</option>
              {hardware.output && <option>Headphones / External</option>}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Sample Rate</span>
            <span className="text-muted-foreground text-xs">44.1 kHz</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Buffer Size</span>
            <span className="text-muted-foreground text-xs">256 samples</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">MIDI Devices</span>
            <span className={cn("text-xs font-semibold", hardware.midi ? "text-green-500" : "text-muted-foreground")}>{hardware.midi ? "Connected" : "None detected"}</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}