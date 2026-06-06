import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RELAX_CATEGORIES } from "@/lib/relaxConfig";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
  title: "", description: "", category: "movies", media_type: "video",
  media_url: "", thumbnail_url: "", backdrop_url: "", year: "", rating: "",
  tags: "", featured: false,
};

export default function AddMediaDialog({ open, onOpenChange, editItem, defaultCategory, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editItem) {
      setForm({
        ...EMPTY,
        ...editItem,
        rating: editItem.rating ?? "",
        tags: Array.isArray(editItem.tags) ? editItem.tags.join(", ") : "",
      });
    } else {
      setForm({ ...EMPTY, category: defaultCategory || "movies" });
    }
  }, [editItem, defaultCategory, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const uploadThumb = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set(field, file_url);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.category.trim() || !form.media_url.trim()) {
      toast.error("Title, category and media URL are required");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description,
      category: form.category.trim().toLowerCase(),
      media_type: form.media_type,
      media_url: form.media_url.trim(),
      thumbnail_url: form.thumbnail_url,
      backdrop_url: form.backdrop_url,
      year: form.year,
      rating: form.rating === "" ? undefined : Number(form.rating),
      featured: form.featured,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    };
    try {
      if (editItem) await base44.entities.RelaxMedia.update(editItem.id, payload);
      else await base44.entities.RelaxMedia.create(payload);
      toast.success(editItem ? "Updated" : "Added to the universe");
      onSaved?.();
      onOpenChange(false);
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Media" : "Add to the Universe"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Interstellar" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category *</Label>
              <Input
                list="relax-cats"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="movies, tv, games..."
              />
              <datalist id="relax-cats">
                {RELAX_CATEGORIES.map((c) => <option key={c.key} value={c.key} />)}
              </datalist>
              <p className="text-[10px] text-muted-foreground mt-1">Type a new name to create a new category.</p>
            </div>
            <div>
              <Label>Plays as</Label>
              <select
                value={form.media_type}
                onChange={(e) => set("media_type", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="video">Video (in-app)</option>
                <option value="audio">Audio / Radio (in-app)</option>
                <option value="iframe">Embedded app (in-app)</option>
                <option value="link">External link</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Media URL *</Label>
            <Input value={form.media_url} onChange={(e) => set("media_url", e.target.value)} placeholder="YouTube, stream, or website URL" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Poster / Thumbnail</Label>
              <Input value={form.thumbnail_url} onChange={(e) => set("thumbnail_url", e.target.value)} placeholder="Image URL" />
              <label className="mt-1 inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer">
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadThumb(e, "thumbnail_url")} />
              </label>
            </div>
            <div>
              <Label>Backdrop (optional)</Label>
              <Input value={form.backdrop_url} onChange={(e) => set("backdrop_url", e.target.value)} placeholder="Wide image URL" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Year / Meta</Label>
              <Input value={form.year} onChange={(e) => set("year", e.target.value)} placeholder="2024" />
            </div>
            <div>
              <Label>Rating (0-10)</Label>
              <Input type="number" min="0" max="10" step="0.1" value={form.rating} onChange={(e) => set("rating", e.target.value)} placeholder="8.5" />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Short synopsis..." className="h-20" />
          </div>

          <div>
            <Label>Tags (comma separated)</Label>
            <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="sci-fi, chill, classic" />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} className="w-4 h-4 rounded accent-primary" />
            Feature in hero spotlight
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editItem ? "Save Changes" : "Add Media"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}