import { useState, useEffect } from 'react';

export function useAudioDevices() {
  const [devices, setDevices] = useState({ input: [], output: [], midi: [] });
  const [selectedDevices, setSelectedDevices] = useState({
    input: localStorage.getItem('audioInputDevice') || 'default',
    output: localStorage.getItem('audioOutputDevice') || 'default',
    midi: localStorage.getItem('midiInputDevice') || null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        setLoading(true);
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        
        const inputDevices = mediaDevices.filter(d => d.kind === 'audioinput');
        const outputDevices = mediaDevices.filter(d => d.kind === 'audiooutput');
        
        setDevices({
          input: inputDevices,
          output: outputDevices,
          midi: [], // MIDI handled separately via Web MIDI API
        });

        // Attempt to get MIDI devices if available
        if (navigator.requestMIDIAccess) {
          try {
            const midiAccess = await navigator.requestMIDIAccess();
            const midiInputs = Array.from(midiAccess.inputs.values());
            setDevices(prev => ({ ...prev, midi: midiInputs }));
          } catch {
            // MIDI not available or user denied permission
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    enumerateDevices();

    // Listen for device changes
    const handleDeviceChange = () => enumerateDevices();
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  const selectDevice = (type, deviceId) => {
    setSelectedDevices(prev => ({ ...prev, [type]: deviceId }));
    if (type === 'input') localStorage.setItem('audioInputDevice', deviceId);
    if (type === 'output') localStorage.setItem('audioOutputDevice', deviceId);
    if (type === 'midi') localStorage.setItem('midiInputDevice', deviceId);
  };

  const getDeviceName = (type) => {
    const deviceId = selectedDevices[type];
    if (!deviceId || deviceId === 'default') return 'Default';
    const device = devices[type].find(d => d.deviceId === deviceId);
    return device?.label || 'Unknown Device';
  };

  return {
    devices,
    selectedDevices,
    selectDevice,
    getDeviceName,
    loading,
    error,
  };
}