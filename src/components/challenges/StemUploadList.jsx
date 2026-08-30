import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Upload, X, Music } from "lucide-react";

export default function StemUploadList({ stems, onChange }) {
  const inputRef = useRef();

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newStems = files.map((file) => ({ file, name: file.name.replace(/\.[^/.]+$/, "") }));
    onChange([...stems, ...newStems]);
    e.target.value = "";
  };

  const updateName = (idx, name) => {
    onChange(stems.map((s, i) => (i === idx ? { ...s, name } : s)));
  };

  const removeStem = (idx) => {
    onChange(stems.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div
        className="relative border-2 border-dashed border-border rounded-xl h-20 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".wav,.mp3,.flac,.aiff,audio/*"
          className="hidden"
          onChange={handleFiles}
        />
        <div className="text-center text-muted-foreground pointer-events-none">
          <Upload className="w-5 h-5 mx-auto mb-1 opacity-40" />
          <p className="text-sm">Click to upload stem files</p>
        </div>
      </div>
      {stems.length > 0 && (
        <div className="space-y-2">
          {stems.map((s, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-secondary/40">
              <Music className="w-4 h-4 text-primary shrink-0" />
              <Input
                value={s.name}
                onChange={(e) => updateName(i, e.target.value)}
                placeholder="Stem name"
                className="h-8 bg-transparent border-0 focus-visible:ring-1"
              />
              <button type="button" onClick={() => removeStem(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}