import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

export default function HardwarePreferencesDialog({ open, onOpenChange, hardware, audioSettings, setAudioSettings, onRefreshMidi }) {
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
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Sample Rate</span>
            <select 
              value={audioSettings?.sampleRate || "44.1 kHz"}
              onChange={(e) => setAudioSettings && setAudioSettings(prev => ({...prev, sampleRate: e.target.value}))}
              className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-xs text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="44.1 kHz">44.1 kHz</option>
              <option value="48 kHz">48 kHz</option>
              <option value="88.2 kHz">88.2 kHz</option>
              <option value="96 kHz">96 kHz</option>
              <option value="192 kHz">192 kHz</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Buffer Size</span>
            <select 
              value={audioSettings?.bufferSize || "256"}
              onChange={(e) => setAudioSettings && setAudioSettings(prev => ({...prev, bufferSize: e.target.value}))}
              className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-xs text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="128">128 samples</option>
              <option value="256">256 samples</option>
              <option value="512">512 samples</option>
              <option value="1024">1024 samples</option>
              <option value="2048">2048 samples</option>
            </select>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="font-medium">MIDI Devices</span>
            <div className="flex items-center gap-3">
              <span className={cn("text-xs font-semibold", hardware.midi ? "text-green-500" : "text-muted-foreground")}>
                {hardware.midi ? "Connected" : "None detected"}
              </span>
              <Button variant="outline" size="sm" onClick={onRefreshMidi} className="h-7 text-xs gap-1.5 px-2">
                <RefreshCw className={cn("w-3 h-3", hardware?.refreshingMidi && "animate-spin")} /> Refresh
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}