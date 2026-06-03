import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Edit3, Award, Star, Grid, Heart, Users, Zap, Save, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import ArtPostCard from "@/components/explore/ArtPostCard";
import AchievementsPanel from "@/components/profile/AchievementsPanel";
import LevelBadge from "@/components/profile/LevelBadge";

const ROLES = ["Painter", "Illustrator", "Photographer", "Musician", "Writer", "Poet", "3D Artist", "Filmmaker", "Graphic Designer", "Other"];
const GENRES = ["Abstract", "Portrait", "Landscape", "Fantasy", "Sci-Fi", "Minimalism", "Surrealism", "Pop Art", "Street Art", "Classical"];

export default function Profile() {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("posts");
  const [uploading, setUploading] = useState(false);
  const avatarRef = useRef();
  const coverRef = useRef();
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(u => { setUser(u); setForm(u); }); }, []);

  const { data: myPosts = [] } = useQuery({
    queryKey: ["my-posts", user?.id],
    queryFn: () => base44.entities.ArtPost.filter({ creator_id: user.id }, "-created_date"),
    enabled: !!user?.id,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["my-achievements", user?.id],
    queryFn: () => base44.entities.Achievement.filter({ user_id: user.id }),
    enabled: !!user?.id,
  });

  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe({
      display_name: form.display_name,
      bio: form.bio,
      artist_role: form.artist_role,
      location: form.location,
      website: form.website,
      genre: form.genre,
    });
    const updated = await base44.auth.me();
    setUser(updated);
    setForm(updated);
    setSaving(false);
    setEditing(false);
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.auth.updateMe({ avatar_url: file_url });
    const updated = await base44.auth.me();
    setUser(updated);
    setUploading(false);
  };

  const uploadCover = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.auth.updateMe({ cover_url: file_url });
    const updated = await base44.auth.me();
    setUser(updated);
    setUploading(false);
  };

  const toggleGenre = (g) => {
    const current = form.genre || [];
    setForm(f => ({ ...f, genre: current.includes(g) ? current.filter(x => x !== g) : [...current, g] }));
  };

  const totalLikes = myPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const xpForNext = ((Math.floor((user?.xp || 0) / 200) + 1) * 200);
  const xpProgress = ((user?.xp || 0) % 200) / 200 * 100;

  if (!user) return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Cover */}
      <div className="relative h-40 sm:h-52 bg-gradient-to-br from-primary/30 via-secondary to-accent/20 overflow-hidden">
        {user.cover_url && <img src={user.cover_url} className="w-full h-full object-cover" alt="cover" />}
        <div className="absolute inset-0 bg-black/20" />
        <button onClick={() => coverRef.current?.click()} className="absolute top-3 right-3 bg-black/40 text-white p-2 rounded-xl hover:bg-black/60 transition-colors">
          <Camera className="w-4 h-4" />
        </button>
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={uploadCover} />
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Avatar + info */}
        <div className="flex items-end gap-4 -mt-10 mb-4 relative z-10">
          <div className="relative">
            <Avatar className="w-20 h-20 border-4 border-background">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">{user.display_name?.[0] || user.full_name?.[0]}</AvatarFallback>
            </Avatar>
            <button onClick={() => avatarRef.current?.click()} className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors">
              <Camera className="w-3 h-3 text-white" />
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>
          <div className="flex-1 min-w-0 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading font-bold text-xl">{user.display_name || user.full_name}</h1>
              <LevelBadge level={user.level || 1} />
            </div>
            <p className="text-muted-foreground text-sm capitalize">{user.artist_role || "Creator"}</p>
          </div>
          <button
            onClick={() => editing ? save() : setEditing(true)}
            className="pb-2 flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {editing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {editing ? "Save" : "Edit"}
          </button>
        </div>

        {/* XP Bar */}
        <div className="mb-4 bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold">Level {user.level || 1}</span>
            </div>
            <span className="text-xs text-muted-foreground">{user.xp || 0} / {xpForNext} XP</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Posts", value: myPosts.length, icon: Grid },
            { label: "Likes", value: totalLikes, icon: Heart },
            { label: "Awards", value: achievements.length, icon: Award },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card rounded-xl border border-border p-3 text-center">
              <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="font-bold text-lg font-heading">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Edit form */}
        {editing && (
          <div className="bg-card rounded-xl border border-border p-5 mb-6 space-y-4">
            <h3 className="font-heading font-semibold">Edit Profile</h3>
            <input value={form.display_name || ""} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Display name" className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
            <textarea value={form.bio || ""} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell your story..." rows={3} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50" />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location" className="bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <input value={form.website || ""} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="Website" className="bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Role</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <button key={r} onClick={() => setForm(f => ({ ...f, artist_role: r }))} className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-colors", form.artist_role === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>{r}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Genres / Styles</label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map(g => (
                  <button key={g} onClick={() => toggleGenre(g)} className={cn("px-3 py-1 rounded-full text-xs transition-colors", (form.genre || []).includes(g) ? "bg-accent/20 text-accent border border-accent/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>{g}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bio display */}
        {!editing && (
          <div className="mb-6">
            {user.bio && <p className="text-sm text-muted-foreground mb-2">{user.bio}</p>}
            {user.genre?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {user.genre.map(g => <span key={g} className="text-[11px] bg-accent/10 text-accent px-2.5 py-0.5 rounded-full">{g}</span>)}
              </div>
            )}
            {user.location && <p className="text-xs text-muted-foreground">📍 {user.location}</p>}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-6">
          {["posts", "achievements"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={cn("flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors", tab === t ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t === "posts" ? "🎨 Posts" : "🏆 Achievements"}
            </button>
          ))}
        </div>

        {tab === "posts" && (
          myPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-heading font-semibold">No posts yet</p>
              <p className="text-sm mt-1">Share your first piece from the Explore tab!</p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 gap-4 mb-8">
              {myPosts.map(post => (
                <ArtPostCard key={post.id} post={post} currentUser={user} onLike={() => {}} />
              ))}
            </div>
          )
        )}

        {tab === "achievements" && (
          <AchievementsPanel achievements={achievements} userId={user.id} />
        )}
      </div>
    </div>
  );
}