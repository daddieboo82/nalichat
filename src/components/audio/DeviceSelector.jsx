import { useState } from 'react';
import { useAudioDevices } from '@/hooks/useAudioDevices';
import { Button } from '@/components/ui/button';
import { Mic, Volume2, Music, AlertCircle, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";

export default function DeviceSelector({ compact = false }) {
  const { devices, selectedDevices, selectDevice, getDeviceName, loading, error } = useAudioDevices();
  const [expandedSection, setExpandedSection] = useState(null);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading devices...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-2 rounded-lg bg-destructive/10">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">Unable to load audio devices</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Microphone */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-2 flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Microphone
          </label>
          <Select value={selectedDevices.input} onValueChange={(val) => selectDevice('input', val)}>
            <SelectTrigger className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm h-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Mic</SelectItem>
              {devices.input.map(device => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone (${device.deviceId.slice(0, 8)}...)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Speaker/Output */}
        {devices.output.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-2 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Speaker
            </label>
            <Select value={selectedDevices.output} onValueChange={(val) => selectDevice('output', val)}>
              <SelectTrigger className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm h-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Speaker</SelectItem>
                {devices.output.map(device => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Speaker (${device.deviceId.slice(0, 8)}...)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* MIDI */}
        {devices.midi.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-2 flex items-center gap-2">
              <Music className="w-4 h-4" />
              MIDI Input
            </label>
            <Select value={selectedDevices.midi || 'none'} onValueChange={(val) => selectDevice('midi', val === 'none' ? null : val)}>
              <SelectTrigger className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm h-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No MIDI Device</SelectItem>
                {devices.midi.map((device, idx) => (
                  <SelectItem key={idx} value={device.id}>
                    {device.name || `MIDI Device ${idx + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  }

  // Full view with expandable sections
  return (
    <div className="space-y-3 bg-card rounded-xl p-4 border border-border">
      <h3 className="font-semibold text-foreground">Audio Devices</h3>

      {/* Microphone Section */}
      <div className="border border-border/50 rounded-lg p-3">
        <button
          onClick={() => setExpandedSection(expandedSection === 'input' ? null : 'input')}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-accent" />
            <div className="text-left">
              <p className="text-sm font-semibold">Microphone</p>
              <p className="text-xs text-muted-foreground">{getDeviceName('input')}</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {expandedSection === 'input' ? '−' : '+'}
          </span>
        </button>
        {expandedSection === 'input' && (
          <div className="mt-3 space-y-2 pt-3 border-t border-border/50">
            {devices.input.length === 0 ? (
              <p className="text-xs text-muted-foreground">No input devices found</p>
            ) : (
              devices.input.map(device => (
                <Button
                  key={device.deviceId}
                  variant={selectedDevices.input === device.deviceId ? 'default' : 'ghost'}
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => selectDevice('input', device.deviceId)}
                >
                  <Mic className="w-3 h-3 mr-2" />
                  <span className="text-xs">{device.label || `Device ${device.deviceId.slice(0, 8)}`}</span>
                </Button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Speaker Section */}
      {devices.output.length > 0 && (
        <div className="border border-border/50 rounded-lg p-3">
          <button
            onClick={() => setExpandedSection(expandedSection === 'output' ? null : 'output')}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary" />
              <div className="text-left">
                <p className="text-sm font-semibold">Speaker/Headphones</p>
                <p className="text-xs text-muted-foreground">{getDeviceName('output')}</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {expandedSection === 'output' ? '−' : '+'}
            </span>
          </button>
          {expandedSection === 'output' && (
            <div className="mt-3 space-y-2 pt-3 border-t border-border/50">
              {devices.output.map(device => (
                <Button
                  key={device.deviceId}
                  variant={selectedDevices.output === device.deviceId ? 'default' : 'ghost'}
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => selectDevice('output', device.deviceId)}
                >
                  <Volume2 className="w-3 h-3 mr-2" />
                  <span className="text-xs">{device.label || `Device ${device.deviceId.slice(0, 8)}`}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MIDI Section */}
      {devices.midi.length > 0 && (
        <div className="border border-border/50 rounded-lg p-3">
          <button
            onClick={() => setExpandedSection(expandedSection === 'midi' ? null : 'midi')}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-accent" />
              <div className="text-left">
                <p className="text-sm font-semibold">MIDI Controller</p>
                <p className="text-xs text-muted-foreground">
                  {selectedDevices.midi ? 'Connected' : 'Not selected'}
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {expandedSection === 'midi' ? '−' : '+'}
            </span>
          </button>
          {expandedSection === 'midi' && (
            <div className="mt-3 space-y-2 pt-3 border-t border-border/50">
              <Button
                variant={!selectedDevices.midi ? 'default' : 'ghost'}
                className="w-full justify-start text-left h-auto py-2"
                onClick={() => selectDevice('midi', null)}
              >
                <span className="text-xs">None</span>
              </Button>
              {devices.midi.map((device, idx) => (
                <Button
                  key={idx}
                  variant={selectedDevices.midi === device.id ? 'default' : 'ghost'}
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => selectDevice('midi', device.id)}
                >
                  <Music className="w-3 h-3 mr-2" />
                  <span className="text-xs">{device.name || `MIDI Device ${idx + 1}`}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}