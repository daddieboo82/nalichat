import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MEDIUMS = ["original", "remix", "cover", "beat", "production", "mixing", "mastering", "collab"];
const TAGS_SUGGESTIONS = ["hip-hop", "trap", "lofi", "electronic", "ambient", "house", "techno", "synthwave", "dark", "experimental"];

import { Music } from "lucide-react";

export default function UploadArtDialog({ open, onClose, currentUser, onSuccess }) {
  const [form, setForm] = useState({ title: "", description: "", medium: "original", tags: [], price: "" });
  const [imageFile, setImageFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const imageRef = useRef();
  const audioRef = useRef();

  if (!open) return null;

  const handleImage = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleAudio = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setAudioFile(f);
  };

  const toggleTag = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
    }));
  };

  const submit = async () => {
    if (!currentUser || !form.title || !audioFile) return;
    setLoading(true);
    let image_url = null;
    let file_url = null;

    try {
      if (imageFile) {
        const res = await base44.integrations.Core.UploadFile({ file: imageFile });
        image_url = res.file_url;
      }
      
      const audioRes = await base44.integrations.Core.UploadFile({ file: audioFile });
      file_url = audioRes.file_url;

      const parsedPrice = Math.max(0, parseFloat(form.price) || 0);

      await base44.entities.ArtPost.create({
        ...form,
        price: parsedPrice,
        image_url,
        file_url,
        creator_id: currentUser.id,
        creator_name: currentUser.display_name || currentUser.full_name,
        creator_avatar: currentUser.avatar_url,
        likes: 0,
        liked_by: [],
        views: 0,
      });
    } catch (err) {
      console.error(err);
      setLoading(false);
      return;
    }
    
    try {
      // Award XP
      const xp = (currentUser.xp || 0) + 50;
      const level = Math.floor(xp / 200) + 1;
      await base44.auth.updateMe({ xp, level, total_posts: (currentUser.total_posts || 0) + 1 });
    } catch (err) {
      console.error("Failed to update XP:", err);
    }

    setLoading(false);
    onSuccess();
    setForm({ title: "", description: "", medium: "original", tags: [], price: "" });
    setPreview(null);
    setImageFile(null);
    setAudioFile(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="font-heading font-bold text-lg">Release Your Track</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          
          {/* Audio Upload (Required) */}
          <div>
            <span className="text-xs text-muted-foreground mb-2 block">Audio File *</span>
            <label
              htmlFor="audio-upload"
              className={cn("border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors flex items-center justify-center h-20", audioFile ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/50")}
            >
              <div className="text-center text-muted-foreground">
                {audioFile ? (
                  <>
                    <Music className="w-6 h-6 mx-auto mb-1 text-primary" />
                    <p className="text-xs font-medium text-foreground px-4 truncate max-w-[300px]">{audioFile.name}</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto mb-1 opacity-40" />
                    <p className="text-sm">Click to select audio file</p>
                  </>
                )}
              </div>
            </label>
            <input id="audio-upload" ref={audioRef} type="file" accept="audio/*" className="sr-only" onChange={handleAudio} />
          </div>

          {/* Cover Art upload */}
          <div>
            <span className="text-xs text-muted-foreground mb-2 block">Cover Art</span>
            <label
              htmlFor="cover-upload"
              className={cn("border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center", preview ? "h-48" : "h-24")}
            >
              {preview ? (
                <img src={preview} className="w-full h-full object-cover" alt="preview" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                  <p className="text-sm">Click to upload cover art</p>
                </div>
              )}
            </label>
            <input id="cover-upload" ref={imageRef} type="file" accept="image/*" className="sr-only" onChange={handleImage} />
          </div>

          <label htmlFor="track-title" className="sr-only">Track title</label>
          <input
            id="track-title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Track title *"
            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <label htmlFor="track-description" className="sr-only">Track description</label>
          <textarea
            id="track-description"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Track description, production notes, credits..."
            rows={3}
            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
          />

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Medium</label>
            <div className="flex flex-wrap gap-2">
              {MEDIUMS.map(m => (
                <button key={m} onClick={() => setForm(f => ({ ...f, medium: m }))} className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors", form.medium === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Tags</label>
            <div className="flex flex-wrap gap-2">
              {TAGS_SUGGESTIONS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)} className={cn("px-3 py-1 rounded-full text-xs transition-colors", form.tags.includes(tag) ? "bg-accent/20 text-accent border border-accent/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="price-input" className="text-xs text-muted-foreground mb-2 block">Price (USD)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                id="price-input"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="0 for free"
                className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Leave at 0 or empty for free downloads</p>
          </div>

          <button
            onClick={submit}
            disabled={loading || !form.title || !audioFile}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Releasing...</> : <><Upload className="w-4 h-4" /> Release & Earn 50 XP</>}
          </button>
        </div>
      </div>
    </div>
  );
}