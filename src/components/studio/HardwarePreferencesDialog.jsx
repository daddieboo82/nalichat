import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

export default function HardwarePreferencesDialog({ open, onOpenChange, hardware, audioSettings, setAudioSettings, onRefreshMidi }) {
  const [localSettings, setLocalSettings] = React.useState(audioSettings || {});

  React.useEffect(() => {
    if (open) {
      setLocalSettings(audioSettings || {});
    }
  }, [open, audioSettings]);

  const handleApply = () => {
    if (setAudioSettings) {
      setAudioSettings(localSettings);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground z-[200]">
        <DialogHeader>
          <DialogTitle>Hardware Preferences</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 text-sm max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Driver Type</span>
            <Select 
              value={localSettings?.driverType || "ASIO (Recommended)"}
              onValueChange={(val) => setLocalSettings(prev => ({...prev, driverType: val}))}
            >
              <SelectTrigger className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                <SelectValue placeholder="Driver Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASIO (Recommended)">ASIO (Recommended)</SelectItem>
                <SelectItem value="CoreAudio">CoreAudio</SelectItem>
                <SelectItem value="WASAPI">WASAPI</SelectItem>
                <SelectItem value="MME/DirectX">MME/DirectX</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Audio Input</span>
            <Select 
              value={localSettings?.audioInput || "System Default"}
              onValueChange={(val) => setLocalSettings(prev => ({...prev, audioInput: val}))}
            >
              <SelectTrigger className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                <SelectValue placeholder="Audio Input" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="System Default">System Default</SelectItem>
                {hardware.interface && <SelectItem value="USB Audio Interface">USB Audio Interface</SelectItem>}
                {hardware.mic && <SelectItem value="Built-in Microphone">Built-in Microphone</SelectItem>}
              </SelectContent>
            </Select>
          </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Audio Output</span>
              <Select 
                value={localSettings?.audioOutput || "System Default"}
                onValueChange={(val) => setLocalSettings(prev => ({...prev, audioOutput: val}))}
              >
                <SelectTrigger className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="Audio Output" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="System Default">System Default</SelectItem>
                  {hardware.output && <SelectItem value="Headphones / External">Headphones / External</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Clock Source</span>
              <Select 
                value={localSettings?.clockSource || "Internal"}
                onValueChange={(val) => setLocalSettings(prev => ({...prev, clockSource: val}))}
              >
                <SelectTrigger className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="Clock Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Internal">Internal</SelectItem>
                  <SelectItem value="S/PDIF">S/PDIF</SelectItem>
                  <SelectItem value="ADAT">ADAT</SelectItem>
                  <SelectItem value="Word Clock">Word Clock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Direct Monitoring</span>
              <Select 
                value={localSettings?.directMonitoring || "Off"}
                onValueChange={(val) => setLocalSettings(prev => ({...prev, directMonitoring: val}))}
              >
                <SelectTrigger className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="Direct Monitoring" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Off">Off</SelectItem>
                  <SelectItem value="On (Hardware)">On (Hardware)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Noise Cancellation</span>
              <Select 
                value={localSettings?.noiseCancellation || "Off"}
                onValueChange={(val) => setLocalSettings(prev => ({...prev, noiseCancellation: val}))}
              >
                <SelectTrigger className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="Noise Cancellation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Off">Off</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Adaptive">Adaptive (AI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Channel Config</span>
              <Select 
                value={localSettings?.channelConfig || "Stereo (2.0)"}
                onValueChange={(val) => setLocalSettings(prev => ({...prev, channelConfig: val}))}
              >
                <SelectTrigger className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="Channel Config" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mono (1.0)">Mono (1.0)</SelectItem>
                  <SelectItem value="Stereo (2.0)">Stereo (2.0)</SelectItem>
                  <SelectItem value="Surround (5.1)">Surround (5.1)</SelectItem>
                  <SelectItem value="Surround (7.1)">Surround (7.1)</SelectItem>
                  <SelectItem value="Atmos (7.1.4)">Atmos (7.1.4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
            <span className="font-medium">Sample Rate</span>
            <Select 
              value={localSettings?.sampleRate || "44.1 kHz"}
              onValueChange={(val) => setLocalSettings(prev => ({...prev, sampleRate: val}))}
            >
              <SelectTrigger className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                <SelectValue placeholder="Sample Rate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="44.1 kHz">44.1 kHz</SelectItem>
                <SelectItem value="48 kHz">48 kHz</SelectItem>
                <SelectItem value="88.2 kHz">88.2 kHz</SelectItem>
                <SelectItem value="96 kHz">96 kHz</SelectItem>
                <SelectItem value="192 kHz">192 kHz</SelectItem>
              </SelectContent>
            </Select>
          </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Buffer Size</span>
            <Select 
              value={String(localSettings?.bufferSize || "256")}
              onValueChange={(val) => setLocalSettings(prev => ({...prev, bufferSize: val}))}
            >
              <SelectTrigger className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary">
                <SelectValue placeholder="Buffer Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="128">128 samples</SelectItem>
                <SelectItem value="256">256 samples</SelectItem>
                <SelectItem value="512">512 samples</SelectItem>
                <SelectItem value="1024">1024 samples</SelectItem>
                <SelectItem value="2048">2048 samples</SelectItem>
              </SelectContent>
            </Select>
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
          <Button onClick={handleApply}>Apply Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}