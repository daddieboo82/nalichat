import { useCallback, useEffect, useState } from "react";
import { Mic, RefreshCw } from "lucide-react";
import { MICROPHONE_SELECTION_EVENT, preferredMicrophoneId } from "@/lib/microphoneCapture";

export default function MicrophoneInputPicker() {
  const [inputs, setInputs] = useState([]);
  const [selected, setSelected] = useState(() => preferredMicrophoneId() || "default");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setStatus("This browser does not support listing microphones. The device default may still work.");
      return;
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const nextInputs = all.filter(device => device.kind === "audioinput" && device.deviceId);
      setInputs(nextInputs);
      setStatus("");
    } catch {
      setStatus("Unable to list microphones. Check browser permissions.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleDevicesChanged = () => { void refresh(); };
    const handleStorageChanged = (event) => {
      if (event.key === "audioInputDevice") setSelected(preferredMicrophoneId() || "default");
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", handleDevicesChanged);
    window.addEventListener("storage", handleStorageChanged);
    const handleLocalChange = () => setSelected(preferredMicrophoneId() || "default");
    window.addEventListener(MICROPHONE_SELECTION_EVENT, handleLocalChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handleDevicesChanged);
      window.removeEventListener("storage", handleStorageChanged);
      window.removeEventListener(MICROPHONE_SELECTION_EVENT, handleLocalChange);
    };
  }, [refresh]);

  const enableAndRefresh = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Microphone access is not supported here. Use a secure browser or the device's permissions settings.");
      return;
    }
    setBusy(true);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await refresh();
    } catch (error) {
      setStatus(error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError"
        ? "Microphone access was denied. Allow access in your browser or device settings."
        : "Microphone is unavailable. Check that it is connected and not in use.");
    } finally {
      stream?.getTracks?.().forEach(track => track.stop());
      setBusy(false);
    }
  };

  const selectedAvailable = selected === "default" || inputs.some(input => input.deviceId === selected);

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2">
      <label htmlFor="nali-help-microphone" className="flex items-center gap-2 text-sm font-semibold">
        <Mic className="h-4 w-4 text-primary" /> Microphone input
      </label>
      <select
        id="nali-help-microphone"
        value={selected}
        onChange={event => {
          const value = event.target.value;
          try {
            localStorage.setItem("audioInputDevice", value);
            setSelected(value);
            window.dispatchEvent(new Event(MICROPHONE_SELECTION_EVENT));
            setStatus(value === "default" ? "Using your device's default microphone." : "Microphone saved for future recordings and calls.");
          } catch {
            setStatus("This browser could not save your microphone preference.");
          }
        }}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      >
        <option value="default">System default microphone</option>
        {!selectedAvailable && <option value={selected}>Saved microphone (currently unavailable)</option>}
        {inputs.filter(input => input.deviceId !== "default").map((input, index) => (
          <option key={input.deviceId} value={input.deviceId}>
            {input.label || `Microphone ${index + 1}`}
          </option>
        ))}
      </select>
      {!selectedAvailable && <p className="text-xs text-amber-500">The saved microphone is not currently listed. It may be disconnected or hidden until permission is granted; recording will try it, then the system default if unavailable.</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => { void enableAndRefresh(); }}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
      >
        <RefreshCw className="h-4 w-4" /> {busy ? "Checking microphones…" : "Allow microphone & refresh"}
      </button>
      <p className="text-xs text-muted-foreground">Built-in, wired, USB, headset and Bluetooth inputs appear when your browser and device expose them. The selection applies to new recordings and calls.</p>
      {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}
