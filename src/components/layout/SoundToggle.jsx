import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useSound } from "@/hooks/use-sound";

export default function SoundToggle() {
  const { isSoundEnabled, toggleSound } = useSound();
  const [enabled, setEnabled] = useState(isSoundEnabled);

  const handleToggle = () => {
    toggleSound();
    setEnabled(isSoundEnabled());
  };

  return (
    <button
      onClick={handleToggle}
      title={enabled ? "Mute UI sounds" : "Enable UI sounds"}
      className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
    >
      {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
    </button>
  );
}