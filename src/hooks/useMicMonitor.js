import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useMicMonitor — opens a live microphone stream for pre-flight level monitoring
 * (without recording). Exposes permission state + a real-time peak level (0..1).
 *
 * Call start(deviceId) to request access and begin monitoring; stop() to release
 * the mic (e.g. right before the recorder takes over).
 */
export function useMicMonitor() {
  const [permission, setPermission] = useState('unknown'); // 'unknown' | 'granted' | 'denied' | 'prompt'
  const [level, setLevel] = useState(0); // 0..1 peak amplitude
  const [monitoring, setMonitoring] = useState(false);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const startRequestRef = useRef(0);

  const stop = useCallback(() => {
    startRequestRef.current += 1;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setMonitoring(false);
    setLevel(0);
  }, []);

  const start = useCallback(async (deviceId) => {
    const requestId = ++startRequestRef.current;
    setError(null);
    try {
      const constraints = {
        audio: deviceId && deviceId !== 'default'
          ? { deviceId: { exact: deviceId } }
          : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (requestId !== startRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setPermission('granted');

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      if (requestId !== startRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        void audioCtx.close().catch(() => {});
        return;
      }
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      setMonitoring(true);

      const data = new Uint8Array(analyser.fftSize);
      const loop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        setLevel(peak);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      if (requestId !== startRequestRef.current) return;
      if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'SecurityError')) {
        setPermission('denied');
      } else if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.name === 'OverconstrainedError')) {
        setError('No microphone found. Connect a mic and try again.');
        setPermission('prompt');
      } else {
        setError((err && err.message) || 'Could not access microphone');
        setPermission('prompt');
      }
    }
  }, []);

  // Detect already-granted permission from device labels (no prompt).
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const inputs = (devs || []).filter(d => d.kind === 'audioinput');
      const alreadyGranted = inputs.some(d => d.label && d.label.length > 0);
      if (alreadyGranted && permission === 'unknown') setPermission('granted');
    }).catch(() => {});
  }, [permission]);

  useEffect(() => () => stop(), [stop]);

  return { permission, level, monitoring, error, start, stop };
}