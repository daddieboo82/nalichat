import { secureUploadFile } from "@/lib/secureUpload";
import { validateUpload } from "@/lib/uploadValidation";
import { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { recordSquadActivity } from "@/lib/squadBonus";
import { toast } from "sonner";

const MEDIUMS = ["original", "remix", "cover", "beat", "production", "mixing", "mastering", "collab"];
const TAGS_SUGGESTIONS = ["hip-hop", "trap", "lofi", "electronic", "ambient", "house", "techno", "synthwave", "dark", "experimental"];

import { Music } from "lucide-react";

export default function UploadArtDialog({ open, onClose, currentUser, onSuccess, sourceFile = null }) {
  const [form, setForm] = useState({ title: "", description: "", medium: "original", tags: [], is_explicit: false });
  const [imageFile, setImageFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const [loading, setLoading] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const imageRef = useRef();
  const audioRef = useRef();

  useEffect(() => {
    if (!open || !sourceFile?.file_url) return;
    setForm((prev) => ({
      ...prev,
      title: prev.title || sourceFile.name?.replace(/\.[^/.]+$/, "") || "Untitled Track",
    }));
  }, [open, sourceFile?.file_url, sourceFile?.name]);

  if (!open) return null;

  const handleImage = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const validation = validateUpload(f);
    if (!validation.ok) {
      toast.error(validation.error);
      e.target.value = "";
      return;
    }
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleAudio = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const validation = validateUpload(f);
    if (!validation.ok) {
      toast.error(validation.error);
      e.target.value = "";
      return;
    }
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
    const publishingUserId = currentUser?.id;
    if (!publishingUserId || !form.title || (!audioFile && !sourceFile?.file_url)) return;
    setLoading(true);
    let image_url = null;
    let file_url = sourceFile?.file_url || null;
    let createdPost = null;

    try {
      if (imageFile) {
        const res = await secureUploadFile({ file: imageFile });
        image_url = res.file_url;
      }
      
      if (audioFile) {
        const audioRes = await secureUploadFile({ file: audioFile });
        file_url = audioRes.file_url;
      }

      const published = await base44.functions.invoke("createArtPost", {
        ...form,
        is_explicit: form.is_explicit,
        image_url,
        file_url,
      });
      if (published?.data?.error) throw new Error(published.data.error);
      createdPost = published?.data?.post;
      if (
        published?.data?.success !== true ||
        published?.data?.action !== "create_art_post" ||
        published?.data?.userId !== publishingUserId ||
        published?.data?.postId !== createdPost?.id ||
        createdPost?.creator_id !== publishingUserId
      ) throw new Error("Track release was not confirmed.");
    } catch (err) {
      console.error("Track release failed:", err);
      toast.error(err?.message || "Track release failed. Your selections are still here so you can retry.");
      setLoading(false);
      return;
    }
    
    if (createdPost?.id) {
      try {
        const reward = await base44.functions.invoke("claimPublishedPostReward", { postId: createdPost.id });
        if (
          reward?.data?.success !== true ||
          reward?.data?.action !== "claim_publish_reward" ||
          reward?.data?.userId !== publishingUserId ||
          reward?.data?.postId !== createdPost.id
        ) {
          throw new Error("Publish reward was not confirmed.");
        }
      } catch (err) {
        console.error("Failed to award publish XP:", err);
      }
      recordSquadActivity("art_post", createdPost.id, publishingUserId);
    }

    setLoading(false);
    onSuccess();
    setForm({ title: "", description: "", medium: "original", tags: [], is_explicit: false });
    setPreview(null);
    setImageFile(null);
    setAudioFile(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4">
      <div className="ui-surface flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card/95 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border p-4 sm:p-5">
          <h2 className="font-heading font-bold text-lg">Release Your Track</h2>
          <button onClick={onClose} className="ui-hover flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"><X className="w-5 h-5" /></button>
        </div>
        <div className="custom-scrollbar space-y-5 overflow-y-auto overscroll-contain p-4 [-webkit-overflow-scrolling:touch] sm:p-5">
          
          {/* Audio Upload (Required) */}
          <div>
            {sourceFile?.file_url && !audioFile && (
              <div className="mb-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs">
                Publishing from Files: <span className="font-semibold">{sourceFile.name || "Selected audio"}</span>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground block">Audio File *</span>
              <div className="flex gap-2">
                
                
              </div>
            </div>
            <div
              className={cn("relative border-2 border-dashed rounded-2xl overflow-hidden cursor-pointer transition-colors flex items-center justify-center h-20", audioFile ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/50")}
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
              
            </div>
            <div
              className={cn("relative border-2 border-dashed border-border rounded-2xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center", preview ? "h-48" : "h-24")}
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
              className="min-h-11 w-full rounded-xl border border-border/70 bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              className="min-h-[96px] w-full resize-y rounded-xl border border-border/70 bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label id="medium-group-label" className="text-xs text-muted-foreground mb-2 block">Medium</label>
            <div role="radiogroup" aria-labelledby="medium-group-label" className="flex flex-wrap gap-2">
              {MEDIUMS.map(m => (
                <button type="button" role="radio" aria-checked={form.medium === m} id={`medium-${m}`} aria-label={`Select medium ${m}`} key={m} onClick={() => setForm(f => ({ ...f, medium: m }))} className={cn("ui-hover min-h-10 rounded-xl px-3 py-1 text-xs font-semibold capitalize transition-colors focus-visible:ring-2 focus-visible:ring-primary/40", form.medium === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <fieldset>
            <legend className="text-xs text-muted-foreground mb-2 block">Content Rating</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Clean", value: false },
                { label: "Explicit", value: true },
              ].map(option => {
                const id = `content-rating-${option.label.toLowerCase()}`;
                return (
                  <label
                    key={option.label}
                    htmlFor={id}
                    className={cn(
                      "ui-hover min-h-10 cursor-pointer rounded-xl px-3 py-1 text-xs font-semibold transition-colors focus-within:ring-2 focus-within:ring-primary/40",
                      form.is_explicit === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <input
                      id={id}
                      type="radio"
                      name="content-rating"
                      className="sr-only"
                      checked={form.is_explicit === option.value}
                      onChange={() => setForm(f => ({ ...f, is_explicit: option.value }))}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="custom-tag-input" id="tags-group-label" className="text-xs text-muted-foreground mb-2 block">Tags</label>
            <div className="flex gap-2 mb-3">
              <input
                id="custom-tag-input"
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Type a tag and press Enter or Add..."
                className="min-h-11 w-full rounded-xl border border-border/70 bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = customTag.trim().toLowerCase().replace(/^#/, '');
                    if (val && !form.tags.includes(val)) {
                      setForm(f => ({ ...f, tags: [...f.tags, val] }));
                    }
                    setCustomTag('');
                  }
                }}
              />
              <button
                type="button"
                aria-label="Add tag"
                className="ui-hover min-h-11 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={() => {
                  const val = customTag.trim().toLowerCase().replace(/^#/, '');
                  if (val && !form.tags.includes(val)) {
                    setForm(f => ({ ...f, tags: [...f.tags, val] }));
                  }
                  setCustomTag('');
                }}
              >
                Add
              </button>
            </div>
            <div role="group" aria-labelledby="tags-group-label" className="flex flex-wrap gap-2">
              {form.tags.filter(t => !TAGS_SUGGESTIONS.includes(t)).map(tag => (
                <button type="button" role="checkbox" aria-checked={true} id={`tag-${tag}`} aria-label={`Remove tag ${tag}`} key={tag} onClick={() => toggleTag(tag)} className="ui-hover min-h-10 rounded-xl border border-accent/30 bg-accent/20 px-3 py-1 text-xs text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent/40">
                  #{tag}
                </button>
              ))}
              {TAGS_SUGGESTIONS.map(tag => (
                <button type="button" role="checkbox" aria-checked={form.tags.includes(tag)} id={`tag-${tag}`} aria-label={`Toggle tag ${tag}`} key={tag} onClick={() => toggleTag(tag)} className={cn("ui-hover min-h-10 rounded-xl px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-accent/40", form.tags.includes(tag) ? "bg-accent/20 text-accent border border-accent/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  #{tag}
                </button>
              ))}
            </div>
          </div>

        </div>
        <div className="shrink-0 border-t border-border bg-card/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          <button
            type="button"
            onClick={submit}
            id="publish-track-button"
            title="Publish Track"
            aria-label="Publish Track"
            disabled={loading || !form.title || (!audioFile && !sourceFile?.file_url)}
            className="ui-hover flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</> : <><Upload className="w-4 h-4" /> Publish Track</>}
          </button>
        </div>
      </div>
    </div>
  );
}