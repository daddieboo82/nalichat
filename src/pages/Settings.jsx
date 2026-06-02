import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, Loader2, X, Plus } from "lucide-react";
import { toast } from "sonner";

const GENRES = ["Hip-Hop", "R&B", "Pop", "Rock", "Electronic", "Jazz", "Latin", "Afrobeats", "Country", "Classical", "Reggae", "Gospel", "Indie", "Metal", "Soul", "Funk", "Trap", "Lo-fi", "Alternative"];

export default function Settings() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ display_name: "", bio: "", role: "artist", location: "", genres: [], avatar_url: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [genreInput, setGenreInput] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm({
        display_name: u.display_name || u.full_name || "",
        bio: u.bio || "",
        role: u.role || "artist",
        location: u.location || "",
        genres: u.genres || [],
        avatar_url: u.avatar_url || "",
      });
    });
  }, []);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, avatar_url: file_url }));
    setUploading(false);
  };

  const addGenre = (genre) => {
    if (genre && !form.genres.includes(genre)) {
      setForm(f => ({ ...f, genres: [...f.genres, genre] }));
    }
    setGenreInput("");
  };

  const removeGenre = (genre) => {
    setForm(f => ({ ...f, genres: f.genres.filter(g => g !== genre) }));
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe(form);
    toast.success("Profile updated!");
    setSaving(false);
  };

  if (!user) return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto p-6 py-12">
        <h1 className="text-2xl font-heading font-bold mb-8">Profile Settings</h1>

        {/* Avatar */}
        <div className="flex items-center gap-6 mb-8">
          <div className="relative group">
            <Avatar className="w-20 h-20 rounded-2xl">
              <AvatarImage src={form.avatar_url} className="rounded-2xl" />
              <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold rounded-2xl">
                {form.display_name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            </button>
          </div>
          <div>
            <p className="font-heading font-semibold">{user.full_name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Display Name / Artist Name</label>
            <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} className="bg-secondary/50 border-0 rounded-xl" placeholder="Your stage name..." />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Role</label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger className="bg-secondary/50 border-0 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="artist">🎤 Artist</SelectItem>
                <SelectItem value="producer">🎹 Producer</SelectItem>
                <SelectItem value="engineer">🎛️ Engineer</SelectItem>
                <SelectItem value="ar">📋 A&R</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Bio</label>
            <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className="bg-secondary/50 border-0 rounded-xl min-h-[100px]" placeholder="Tell others about yourself..." />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Location</label>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="bg-secondary/50 border-0 rounded-xl" placeholder="City, State" />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Genres</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {form.genres.map(g => (
                <Badge key={g} className="bg-primary/20 text-primary border-0 cursor-pointer hover:bg-primary/30" onClick={() => removeGenre(g)}>
                  {g} <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {GENRES.filter(g => !form.genres.includes(g)).map(g => (
                <Badge key={g} variant="outline" className="cursor-pointer border-border hover:border-primary hover:text-primary transition-colors text-xs" onClick={() => addGenre(g)}>
                  <Plus className="w-2.5 h-2.5 mr-1" /> {g}
                </Badge>
              ))}
            </div>
          </div>

          <Button className="w-full rounded-xl bg-primary hover:bg-primary/90 mt-4" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Profile
          </Button>
        </div>
      </div>
    </div>
  );
}