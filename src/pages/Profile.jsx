import { secureUploadFile } from "@/lib/secureUpload";
import { validateUpload } from "@/lib/uploadValidation";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Edit3, Award, Grid, Eye, Zap, Save } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import ArtPostCard from "@/components/explore/ArtPostCard";
import AchievementsPanel from "@/components/profile/AchievementsPanel";
import LevelBadge from "@/components/profile/LevelBadge";
import TopWorksGallery from "@/components/profile/TopWorksGallery";
import NaliPresenceIndicator from "@/components/nali/NaliPresenceIndicator";
import NaliContextHint from "@/components/nali/NaliContextHint";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { toast } from "sonner";

const ROLES = [
  { value: "artist", label: "Artist" },
  { value: "producer", label: "Producer" },
  { value: "engineer", label: "Engineer" },
  { value: "ar", label: "A&R" },
];
const GENRES = ["Hip-Hop", "Trap", "Lo-Fi", "Electronic", "House", "Techno", "Ambient", "R&B", "Indie", "Alternative"];

async function listAllUserPosts(userId) {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.ArtPost.filter(
      { creator_id: userId },
      "-created_date",
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function Profile() {
  const location = useLocation();
  const { user: currentUser, checkUserAuth } = useAuth();
  const targetUserId = new URLSearchParams(location.search).get("id");
  
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [formOwnerId, setFormOwnerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("posts");
  const [uploading, setUploading] = useState(false);
  const avatarRef = useRef();
  const coverRef = useRef();
  const activeUserIdRef = useRef(currentUser?.id || null);

  useEffect(() => {
    activeUserIdRef.current = currentUser?.id || null;
  }, [currentUser?.id]);
  const queryClient = useQueryClient();

  const { data: targetUser, isLoading: targetUserLoading, isError: targetUserError, refetch: refetchTargetUser } = useQuery({
    queryKey: ["user", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;
      const res = await base44.functions.invoke("listPublicUsers", { userId: targetUserId });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.viewerUserId !== currentUser?.id ||
        res?.data?.requestedUserId !== targetUserId ||
        !Array.isArray(res?.data?.users)
      ) {
        throw new Error("Profile lookup was not confirmed");
      }
      return res.data.users[0] || null;
    },
    enabled: !!targetUserId,
  });

  const user = targetUserId ? targetUser : currentUser;
  const isMe = currentUser && user && currentUser.id === user.id;

  useEffect(() => {
    if (user && isMe) {
      setForm(user);
      setFormOwnerId(user.id);
      setEditing(false);
      if (avatarRef.current) avatarRef.current.value = "";
      if (coverRef.current) coverRef.current.value = "";
      return;
    }
    setFormOwnerId(null);
    setEditing(false);
  }, [user, isMe]);

  const { data: myPosts = [], isError: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ["my-posts", user?.id, currentUser?.id],
    queryFn: async () => {
      const [rows, likedRes] = await Promise.all([
        listAllUserPosts(user.id),
        currentUser
          ? base44.functions.invoke("listMyLikedPostIds", {})
          : Promise.resolve({ data: { post_ids: [] } }),
      ]);
      if (
        currentUser &&
        (
          likedRes?.data?.success !== true ||
          likedRes?.data?.userId !== currentUser?.id ||
          !Array.isArray(likedRes?.data?.post_ids) ||
          !likedRes.data.post_ids.every((id) => typeof id === "string" && id.trim())
        )
      ) {
        throw new Error(likedRes?.data?.error || "Liked track state was not confirmed.");
      }
      const likedIds = new Set(likedRes?.data?.post_ids || []);
      return rows.map((post) => ({
        ...post,
        liked_by: currentUser && likedIds.has(post.id) ? [currentUser.id] : [],
      }));
    },
    enabled: !!user?.id,
  });

  const { data: achievements = [], isError: achievementsError, refetch: refetchAchievements } = useQuery({
    queryKey: ["my-achievements", user?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("listPublicAchievements", { userId: user.id });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.viewerUserId !== currentUser?.id ||
        res?.data?.requestedUserId !== user.id ||
        !Array.isArray(res?.data?.achievements)
      ) {
        throw new Error("Achievement lookup was not confirmed");
      }
      return res.data.achievements;
    },
    enabled: !!user?.id,
  });

  const save = async () => {
    const submittingUserId = currentUser?.id;
    if (!submittingUserId || formOwnerId !== submittingUserId) {
      toast.error("Your account changed. Please wait for your profile to reload.");
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("updateMyProfile", {
        display_name: form.display_name,
        bio: form.bio,
        artist_role: form.artist_role,
        location: form.location,
        website: form.website,
        genres: form.genres || [],
      });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "update_my_profile" ||
        res?.data?.userId !== submittingUserId
      ) throw new Error("Profile update was not confirmed");
    // Refresh the authoritative auth context and verify the saved profile is visible.
    const refreshedUser = await checkUserAuth();
    if (!refreshedUser?.id || refreshedUser.id !== submittingUserId) {
      throw new Error("Profile saved, but your session did not refresh.");
    }
    if (activeUserIdRef.current !== submittingUserId) return;
    setEditing(false);
    toast.success("Profile updated.");
    } catch (error) {
      console.error("Profile update failed:", error);
      if (activeUserIdRef.current === submittingUserId) {
        toast.error(error?.message || "Could not update your profile. Please try again.");
      }
    } finally {
      if (activeUserIdRef.current === submittingUserId) setSaving(false);
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files[0];
    const uploadOwnerId = currentUser?.id;
    if (!file || !uploadOwnerId || formOwnerId !== uploadOwnerId) return;
    const validation = validateUpload(file);
    if (!validation.ok) {
      toast.error(validation.error);
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await secureUploadFile({ file });
      if (activeUserIdRef.current !== uploadOwnerId) return;
      const res = await base44.functions.invoke("updateMyProfile", { avatar_url: file_url });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "update_my_profile" ||
        res?.data?.userId !== uploadOwnerId
      ) throw new Error("Profile update was not confirmed");
      const refreshedUser = await checkUserAuth();
      if (
        !refreshedUser?.id ||
        refreshedUser.id !== uploadOwnerId ||
        refreshedUser.avatar_url !== file_url
      ) {
        throw new Error("Profile photo saved, but your session did not refresh.");
      }
      if (activeUserIdRef.current !== uploadOwnerId) return;
      toast.success("Profile photo updated.");
    } catch (error) {
      console.error("Avatar update failed:", error);
      toast.error(error?.message || "Could not update your profile photo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const uploadCover = async (e) => {
    const file = e.target.files[0];
    const uploadOwnerId = currentUser?.id;
    if (!file || !uploadOwnerId || formOwnerId !== uploadOwnerId) return;
    const validation = validateUpload(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await secureUploadFile({ file });
      if (activeUserIdRef.current !== uploadOwnerId) return;
      const res = await base44.functions.invoke("updateMyProfile", { cover_url: file_url });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "update_my_profile" ||
        res?.data?.userId !== uploadOwnerId
      ) throw new Error("Profile update was not confirmed");
      const refreshedUser = await checkUserAuth();
      if (
        !refreshedUser?.id ||
        refreshedUser.id !== uploadOwnerId ||
        refreshedUser.cover_url !== file_url
      ) {
        throw new Error("Profile cover saved, but your session did not refresh.");
      }
      if (activeUserIdRef.current !== uploadOwnerId) return;
      toast.success("Profile cover updated.");
    } catch (error) {
      console.error("Profile cover update failed:", error);
      toast.error(error?.message || "Could not update your profile cover.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const toggleGenre = (g) => {
    const current = form.genres || [];
    setForm(f => ({ ...f, genres: current.includes(g) ? current.filter(x => x !== g) : [...current, g] }));
  };

  const totalPlays = myPosts.reduce((sum, p) => sum + (p.views || 0), 0);
  const xpForNext = ((Math.floor((user?.xp || 0) / 200) + 1) * 200);
  const xpProgress = ((user?.xp || 0) % 200) / 200 * 100;

  if (targetUserId && targetUserLoading) {
    return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }
  if (targetUserId && (targetUserError || !targetUser)) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="ui-surface w-full max-w-sm rounded-3xl border border-border bg-card/70 p-6 text-center">
          <h2 className="font-heading text-xl font-bold">Profile unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">This profile couldn't be loaded. It may no longer be available.</p>
          <button
            type="button"
            onClick={() => void refetchTargetUser()}
            className="ui-hover mt-4 min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!user) return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (isMe && formOwnerId !== user.id) {
    return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <PullToRefresh onRefresh={async () => { queryClient.invalidateQueries({ queryKey: ["my-posts"] }); queryClient.invalidateQueries({ queryKey: ["my-achievements"] }); }} className="h-full overflow-y-auto bg-background">
      {/* Cover */}
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-primary/30 via-secondary to-accent/20 shadow-inner sm:h-56">
        {user.cover_url && <img src={user.cover_url} className="w-full h-full object-cover" alt="cover" />}
        <div className="absolute inset-0 bg-black/20" />
        {isMe && (
          <>
            <button onClick={() => coverRef.current?.click()} className="ui-hover absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/60" aria-label="Change profile cover">
              <Camera className="w-4 h-4" />
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={uploadCover} />
          </>
        )}
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        {/* Avatar + info */}
        <div className="relative z-10 -mt-10 mb-5 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-background shadow-xl ring-1 ring-border/50">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">{user.display_name?.[0] || user.full_name?.[0]}</AvatarFallback>
            </Avatar>
            {isMe && (
              <>
                <button onClick={() => avatarRef.current?.click()} className="ui-hover absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary shadow-lg transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/50" aria-label="Change profile photo">
                  <Camera className="w-3 h-3 text-white" />
                </button>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              </>
            )}
          </div>
          <div className="min-w-[180px] flex-1 pb-1 sm:pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">{user.display_name || user.full_name}</h1>
              <LevelBadge level={user.level || 1} />
            </div>
            <p className="text-muted-foreground text-sm capitalize">{user.artist_role || "Producer"}</p>
          </div>
          {isMe && (
            <button
              onClick={() => editing ? save() : setEditing(true)}
              className="ui-hover flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/10 transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-auto"
            >
              {editing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              {editing ? "Save" : "Edit"}
            </button>
          )}
          <div className="flex w-full flex-col items-start gap-2 pb-1 sm:ml-auto sm:w-auto sm:items-end sm:pb-2">
            <NaliPresenceIndicator surface="profile" size="md" greeting={`Tell me about ${user.display_name || user.full_name || "this artist"} — help me understand their sound and suggest ways to grow their audience.`} />
            <NaliContextHint surface="profile" contextLabel={user.display_name || user.full_name || "profile"} />
          </div>
        </div>

        {/* XP Bar */}
        <div className="ui-surface mb-4 rounded-2xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-3">
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
        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Tracks", value: myPosts.length, icon: Grid },
            { label: "Plays", value: totalPlays, icon: Eye },
            { label: "Awards", value: achievements.length, icon: Award },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="ui-surface rounded-2xl border border-white/[0.06] bg-card/50 p-3 text-center backdrop-blur-xl sm:p-4">
              <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="font-bold text-lg font-heading">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Edit form */}
        {editing && (
          <div className="ui-surface mb-6 space-y-4 rounded-2xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-xl sm:p-5">
            <h3 className="font-heading font-semibold">Edit Profile</h3>
            <input value={form.display_name || form.full_name || ""} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Display name" className="min-h-11 w-full rounded-xl border border-border/70 bg-secondary/40 px-4 py-2.5 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <textarea value={form.bio || ""} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell your story..." rows={3} className="min-h-[96px] w-full resize-y rounded-xl border border-border/70 bg-secondary/40 px-4 py-2.5 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location" className="min-h-11 rounded-xl border border-border/70 bg-secondary/40 px-4 py-2.5 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20" />
              <input value={form.website || ""} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="Website" className="min-h-11 rounded-xl border border-border/70 bg-secondary/40 px-4 py-2.5 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Role</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setForm(f => ({ ...f, artist_role: value }))}
                    className={cn("ui-hover min-h-9 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary/40", form.artist_role === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Genres / Styles</label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map(g => (
                  <button key={g} onClick={() => toggleGenre(g)} className={cn("ui-hover min-h-9 px-3 py-1.5 rounded-full text-xs transition-colors", (form.genres || []).includes(g) ? "bg-accent/20 text-accent border border-accent/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>{g}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bio display */}
        {!editing && (
          <div className="mb-6">
            {user.bio && <p className="text-sm text-muted-foreground mb-2">{user.bio}</p>}
            {Array.isArray(user.genres) && user.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {user.genres.map(g => <span key={g} className="text-[11px] bg-accent/10 text-accent px-2.5 py-0.5 rounded-full">{g}</span>)}
              </div>
            )}
            {user.location && <p className="text-xs text-muted-foreground">📍 {user.location}</p>}
          </div>
        )}

        {/* Tabs */}
        <div className="no-scrollbar mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-secondary/50 p-1.5">
          {["featured", "posts", "achievements"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={cn("ui-hover min-h-10 shrink-0 flex-1 rounded-xl px-3 py-2 text-sm font-semibold capitalize transition-colors", tab === t ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t === "featured" ? "⭐ Featured" : t === "posts" ? "🎨 All Tracks" : "🏆 Achievements"}
            </button>
          ))}
        </div>

        {tab === "featured" && (
          postsError ? (
            <div className="ui-surface rounded-3xl border border-dashed border-border px-4 py-12 text-center text-muted-foreground">
              <p className="font-heading font-semibold text-foreground">Featured works unavailable</p>
              <p className="text-sm mt-1">We couldn't load this creator's tracks.</p>
              <button type="button" onClick={() => void refetchPosts()} className="ui-hover mt-3 min-h-11 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary/50">
                Retry
              </button>
            </div>
          ) : (
            <TopWorksGallery posts={myPosts} />
          )
        )}

        {tab === "posts" && (
          postsError ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-heading font-semibold text-foreground">Tracks unavailable</p>
              <p className="text-sm mt-1">We couldn't load this creator's tracks.</p>
              <button type="button" onClick={() => void refetchPosts()} className="ui-hover mt-3 min-h-11 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary/50">
                Retry
              </button>
            </div>
          ) : myPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-heading font-semibold">No tracks yet</p>
              <p className="text-sm mt-1">Release your first track from the Explore tab!</p>
            </div>
          ) : (
            <div className="mb-8 columns-1 gap-4 sm:columns-2">
              {myPosts.map(post => (
                <ArtPostCard key={post.id} post={post} currentUser={user} onLike={() => {}} />
              ))}
            </div>
          )
        )}

        {tab === "achievements" && (
          achievementsError ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-heading font-semibold text-foreground">Achievements unavailable</p>
              <p className="text-sm mt-1">We couldn't load this creator's achievements.</p>
              <button type="button" onClick={() => void refetchAchievements()} className="ui-hover mt-3 min-h-11 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary/50">
                Retry
              </button>
            </div>
          ) : (
            <AchievementsPanel achievements={achievements} userId={user.id} />
          )
        )}
      </div>
    </PullToRefresh>
  );
}