import { useState, useEffect } from 'react';

function safeGet(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

export function useAudioDevices() {
  const [devices, setDevices] = useState({ input: [], output: [], midi: [] });
  const [selectedDevices, setSelectedDevices] = useState({
    input: safeGet('audioInputDevice', 'default'),
    output: safeGet('audioOutputDevice', 'default'),
    midi: safeGet('midiInputDevice', null),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;

    const enumerateDevices = async () => {
      const currentRequestId = ++requestId;
      try {
        if (!cancelled) setLoading(true);
        if (!navigator.mediaDevices?.enumerateDevices) {
          throw new Error('Media device enumeration is not supported in this browser');
        }
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled || currentRequestId !== requestId) return;
        
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
            if (cancelled || currentRequestId !== requestId) return;
            const midiInputs = Array.from(midiAccess.inputs.values());
            setDevices(prev => ({ ...prev, midi: midiInputs }));
          } catch {
            // MIDI not available or user denied permission
          }
        }
      } catch (err) {
        if (!cancelled && currentRequestId === requestId) {
          setError(err.message);
        }
      } finally {
        if (!cancelled && currentRequestId === requestId) {
          setLoading(false);
        }
      }
    };

    enumerateDevices();

    // Listen for device changes
    const handleDeviceChange = () => enumerateDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    
    return () => {
      cancelled = true;
      requestId += 1;
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, []);

  const selectDevice = (type, deviceId) => {
    setSelectedDevices(prev => ({ ...prev, [type]: deviceId }));
    if (type === 'input') safeSet('audioInputDevice', deviceId);
    if (type === 'output') safeSet('audioOutputDevice', deviceId);
    if (type === 'midi') safeSet('midiInputDevice', deviceId);
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