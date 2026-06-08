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
    setForm(prev => ({
      ...prev,
      title: prev.title || f.name.replace(/\.[^/.]+$/, "")
    }));
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
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground block">Audio File *</span>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  id="auto-fill-test-btn"
                  onClick={() => {
                    const file = new File(["dummy audio content for testing"], "test-audio.mp3", { type: "audio/mpeg" });
                    setAudioFile(file);
                    setForm(f => ({ ...f, title: "Test Track", description: "Automated test description for QA", tags: ["electronic", "ambient"] }));
                  }} 
                  className="text-[10px] bg-secondary text-primary px-2 py-1 rounded hover:bg-secondary/80"
                >
                  Auto-Fill Form (Test)
                </button>
                <button 
                  id="load-mock-audio-btn"
                  type="button" 
                  onClick={() => {
                    const file = new File(["dummy audio content for testing"], "test-audio.mp3", { type: "audio/mpeg" });
                    handleAudio({ target: { files: [file] } });
                    setForm(f => ({ ...f, title: f.title || "Test Track" }));
                  }} 
                  className="text-[10px] text-primary hover:underline"
                >
                  Load Mock Audio
                </button>
              </div>
            </div>
            <div
              className={cn("relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors flex items-center justify-center h-20", audioFile ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/50")}
            >
              <input id="audio-upload" ref={audioRef} type="file" accept="audio/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleAudio} />
              <div className="text-center text-muted-foreground pointer-events-none relative z-0">
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
            </div>
          </div>

          {/* Cover Art upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground block">Cover Art</span>
              <button 
                type="button" 
                onClick={() => {
                  // A tiny 1x1 transparent PNG data URL used as mock image for testing
                  const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                  fetch(dataUrl).then(r => r.blob()).then(blob => {
                    const file = new File([blob], "mock-cover.png", { type: "image/png" });
                    handleImage({ target: { files: [file] } });
                  });
                }} 
                className="text-[10px] text-primary hover:underline"
              >
                Load Mock Cover (Automated Testing)
              </button>
            </div>
            <div
              className={cn("relative border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center", preview ? "h-48" : "h-24")}
            >
              <input id="cover-upload" ref={imageRef} type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleImage} />
              <div className="pointer-events-none relative z-0 w-full h-full flex items-center justify-center">
                {preview ? (
                  <img src={preview} className="w-full h-full object-cover" alt="preview" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                    <p className="text-sm">Click to upload cover art</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="track-title" className="text-xs text-muted-foreground mb-2 block">Track Title *</label>
            <input
              id="track-title"
              name="title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Enter track title..."
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              required
            />
          </div>
          <div>
            <label htmlFor="track-description" className="text-xs text-muted-foreground mb-2 block">Track Description</label>
            <textarea
              id="track-description"
              name="description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Production notes, credits..."
              rows={3}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div>
            <label id="medium-group-label" className="text-xs text-muted-foreground mb-2 block">Medium</label>
            <div role="radiogroup" aria-labelledby="medium-group-label" className="flex flex-wrap gap-2">
              {MEDIUMS.map(m => (
                <button type="button" role="radio" aria-checked={form.medium === m} id={`medium-${m}`} aria-label={`Select medium ${m}`} key={m} onClick={() => setForm(f => ({ ...f, medium: m }))} className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors", form.medium === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label id="tags-group-label" className="text-xs text-muted-foreground mb-2 block">Tags</label>
            <div role="group" aria-labelledby="tags-group-label" className="flex flex-wrap gap-2">
              {TAGS_SUGGESTIONS.map(tag => (
                <button type="button" role="checkbox" aria-checked={form.tags.includes(tag)} id={`tag-${tag}`} aria-label={`Toggle tag ${tag}`} key={tag} onClick={() => toggleTag(tag)} className={cn("px-3 py-1 rounded-full text-xs transition-colors", form.tags.includes(tag) ? "bg-accent/20 text-accent border border-accent/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
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
            type="button"
            onClick={submit}
            id="publish-track-button"
            title="Publish Track"
            aria-label="Publish Track"
            disabled={loading || !form.title || !audioFile}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</> : <><Upload className="w-4 h-4" /> Publish Track</>}
          </button>
        </div>
      </div>
    </div>
  );
}