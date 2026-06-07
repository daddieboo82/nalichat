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
        <div className="space-y-4 py-4 text-sm max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Driver Type</span>
            <select className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
              <option className="text-foreground bg-popover">ASIO (Recommended)</option>
              <option className="text-foreground bg-popover">CoreAudio</option>
              <option className="text-foreground bg-popover">WASAPI</option>
              <option className="text-foreground bg-popover">MME/DirectX</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Audio Input</span>
            <select className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
              <option className="text-foreground bg-popover">System Default</option>
              {hardware.interface && <option className="text-foreground bg-popover">USB Audio Interface</option>}
              {hardware.mic && <option className="text-foreground bg-popover">Built-in Microphone</option>}
            </select>
          </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Audio Output</span>
              <select className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                <option className="text-foreground bg-popover">System Default</option>
                {hardware.output && <option className="text-foreground bg-popover">Headphones / External</option>}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Clock Source</span>
              <select className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                <option className="text-foreground bg-popover">Internal</option>
                <option className="text-foreground bg-popover">S/PDIF</option>
                <option className="text-foreground bg-popover">ADAT</option>
                <option className="text-foreground bg-popover">Word Clock</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Direct Monitoring</span>
              <select className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                <option className="text-foreground bg-popover">Off</option>
                <option className="text-foreground bg-popover">On (Hardware)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
            <span className="font-medium">Sample Rate</span>
            <select 
              value={audioSettings?.sampleRate || "44.1 kHz"}
              onChange={(e) => setAudioSettings && setAudioSettings(prev => ({...prev, sampleRate: e.target.value}))}
              className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="44.1 kHz" className="text-foreground bg-popover">44.1 kHz</option>
              <option value="48 kHz" className="text-foreground bg-popover">48 kHz</option>
              <option value="88.2 kHz" className="text-foreground bg-popover">88.2 kHz</option>
              <option value="96 kHz" className="text-foreground bg-popover">96 kHz</option>
              <option value="192 kHz" className="text-foreground bg-popover">192 kHz</option>
            </select>
          </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Buffer Size</span>
            <select 
              value={audioSettings?.bufferSize || "256"}
              onChange={(e) => setAudioSettings && setAudioSettings(prev => ({...prev, bufferSize: e.target.value}))}
              className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="128" className="text-foreground bg-popover">128 samples</option>
              <option value="256" className="text-foreground bg-popover">256 samples</option>
              <option value="512" className="text-foreground bg-popover">512 samples</option>
              <option value="1024" className="text-foreground bg-popover">1024 samples</option>
              <option value="2048" className="text-foreground bg-popover">2048 samples</option>
            </select>
            </div>
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
          {!hardware.midi && (
            <p className="text-[10px] text-muted-foreground bg-secondary/30 p-2 rounded border border-border/50">
              <strong>Note:</strong> MIDI detection requires a browser with WebMIDI API support (like Chrome or Edge) and allowed site permissions. If using Safari or Firefox, MIDI devices may not be detected natively.
            </p>
          )}
        </div>
        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onOpenChange(false)}>Apply Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}