import { secureUploadFile } from "@/lib/secureUpload";
import { validateUpload } from "@/lib/uploadValidation";
import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, Loader2, X, Plus, BarChart3, Users, Palette, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import DeleteAccountDialog from "@/components/settings/DeleteAccountDialog";
import InteractiveWizard from "@/components/onboarding/InteractiveWizard";
import DeviceSelector from "@/components/audio/DeviceSelector";
import NaliProactivitySettings from "@/components/nali/NaliProactivitySettings";
import { sounds } from "@/hooks/use-sound";
import { isValidAvatarUrl } from "@/lib/avatarValidation";
import PullToRefresh from "@/components/layout/PullToRefresh";
import SubscriptionSettings from "@/components/settings/SubscriptionSettings";
import ChatThemeSettings from "@/components/settings/ChatThemeSettings";
import LockedChatSettings from "@/components/settings/LockedChatSettings";
import { Switch } from "@/components/ui/switch";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

const GENRES = ["Hip-Hop", "R&B", "Pop", "Rock", "Electronic", "Jazz", "Latin", "Afrobeats", "Country", "Classical", "Reggae", "Gospel", "Indie", "Metal", "Soul", "Funk", "Trap", "Lo-fi", "Alternative"];

export default function Settings() {
  const {
    user,
    checkUserAuth,
    isLoadingAuth: loadingUser,
    authError,
  } = useAuth();
  const [form, setForm] = useState({ display_name: "", bio: "", artist_role: "artist", location: "", genres: [], avatar_url: "" });
  const [formOwnerId, setFormOwnerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [genreInput, setGenreInput] = useState("");
  const fileRef = useRef(null);
  const activeUserIdRef = useRef(user?.id || null);

  useEffect(() => {
    activeUserIdRef.current = user?.id || null;
  }, [user?.id]);
  const [showWizard, setShowWizard] = useState(false);
  const { osReducedMotion, userReducedMotion, reduceMotion, setUserReducedMotion } = useReducedMotionPreference();

  useEffect(() => {
    if (!user) {
      setFormOwnerId(null);
      return;
    }
    setForm({
      display_name: user.display_name || user.full_name || "",
      bio: user.bio || "",
      artist_role: user.artist_role || (["artist","producer","engineer","ar"].includes(user.role) ? user.role : "artist"),
      location: user.location || "",
      genres: user.genres || [],
      avatar_url: user.avatar_url || "",
    });
    setFormOwnerId(user.id);
    setGenreInput("");
    setShowWizard(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [user]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    const uploadOwnerId = user?.id;
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
      setForm(f => ({ ...f, avatar_url: file_url }));
    } catch (error) {
      console.error("Settings avatar upload failed:", error);
      toast.error(error?.message || "Could not upload your profile photo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
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
    const submittingUserId = user?.id;
    if (!submittingUserId || formOwnerId !== submittingUserId) {
      toast.error("Your account changed. Please wait for Settings to reload.");
      return;
    }
    setSaving(true);
    try {
      const cleanedForm = { ...form };
      delete cleanedForm.role;
      if (!isValidAvatarUrl(cleanedForm.avatar_url)) {
        cleanedForm.avatar_url = "";
        toast.warning("Your previous avatar URL was invalid and has been cleared. Please upload an image.");
      }
      const res = await base44.functions.invoke("updateMyProfile", cleanedForm);
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "update_my_profile" ||
        res?.data?.userId !== submittingUserId
      ) throw new Error("Profile update was not confirmed");
      // Refresh the global auth context and verify the account reflects the save.
      const refreshedUser = await checkUserAuth();
      if (
        !refreshedUser?.id ||
        refreshedUser.id !== submittingUserId ||
        refreshedUser.display_name !== cleanedForm.display_name ||
        refreshedUser.avatar_url !== cleanedForm.avatar_url
      ) {
        throw new Error("Profile saved, but your session did not refresh.");
      }
      if (activeUserIdRef.current !== submittingUserId) return;
      sounds.success();
      toast.success("Profile updated!");
    } catch (error) {
      console.error("Settings profile save failed:", error);
      if (activeUserIdRef.current === submittingUserId) {
        toast.error(error?.message || "Could not save your profile. Please try again.");
      }
    } finally {
      if (activeUserIdRef.current === submittingUserId) setSaving(false);
    }
  };

  if (loadingUser) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (authError || !user) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="ui-surface w-full max-w-md rounded-3xl border border-border bg-card/70 p-6 text-center">
          <h2 className="text-xl font-bold">Settings unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">We couldn't verify your account. Refresh and try again.</p>
          <Button className="ui-hover mt-4 min-h-11 rounded-xl" variant="outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  // Never render a previous account's local edit form beneath a newly-resolved
  // identity. Wait one effect cycle for the form to hydrate from this user.
  if (formOwnerId !== user.id) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <PullToRefresh onRefresh={async () => { await checkUserAuth(); }} className="h-full overflow-y-auto">
      <div className={`mx-auto max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:py-10 ${reduceMotion ? "reduce-motion-surface" : ""}`}>
        <div className="mb-6"><div className="mb-1 flex items-center gap-2 text-primary"><UserRound className="h-5 w-5" aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Account</span></div><h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Profile Settings</h1><p className="mt-1 text-sm text-muted-foreground">Manage your public artist profile, preferences, privacy, subscription, and devices.</p></div>

        {/* Avatar */}
        <div className="ui-surface relative mb-7 flex flex-col items-center gap-4 overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 p-5 text-center shadow-lg backdrop-blur-xl sm:flex-row sm:gap-6 sm:p-6 sm:text-left">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/20 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
          
          <div className="relative group shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-br from-primary to-pink-500 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-500" />
            <Avatar className="relative z-10 h-24 w-24 rounded-full border-4 border-background shadow-xl">
              <AvatarImage src={form.avatar_url} className="rounded-full object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-pink-500 text-white text-3xl font-black rounded-full">
                {form.display_name?.[0]?.toUpperCase() || user.full_name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-1 z-20 flex cursor-pointer items-center justify-center rounded-full bg-black/60 opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/50" aria-label="Change profile photo"
            >
              {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
            </button>
          </div>
          <div className="relative z-10">
            <h2 className="bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-2xl font-heading font-black text-transparent drop-shadow-sm sm:text-3xl">
              {form.display_name || user.full_name}
            </h2>
            <p className="text-sm font-medium text-muted-foreground mt-1 bg-background/50 px-3 py-1 rounded-full inline-block border border-border/50">
              {user.email}
            </p>
          </div>
        </div>

        <div className="ui-surface space-y-5 rounded-3xl border border-white/[0.06] bg-card/40 p-4 backdrop-blur-xl sm:p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Display Name / Artist Name</label>
            <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} className="h-12 rounded-xl border border-border/50 bg-secondary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" placeholder="Your stage name..." />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Role</label>
            <Select value={form.artist_role} onValueChange={v => setForm(f => ({ ...f, artist_role: v }))}>
              <SelectTrigger className="h-12 rounded-xl border border-border/50 bg-secondary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
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
            <label className="mb-2 block text-sm font-semibold text-foreground">Bio</label>
            <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className="min-h-[120px] resize-y rounded-xl border border-border/50 bg-secondary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" placeholder="Tell others about yourself..." />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Location</label>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="h-12 rounded-xl border border-border/50 bg-secondary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" placeholder="City, State" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Genres</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {form.genres.map(g => (
                <Badge key={g} className="ui-hover min-h-9 cursor-pointer rounded-xl border-0 bg-primary/20 px-2.5 text-primary hover:bg-primary/30 focus-visible:ring-2 focus-visible:ring-primary/40" onClick={() => removeGenre(g)}>
                  {g} <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {GENRES.filter(g => !form.genres.includes(g)).map(g => (
                <Badge key={g} variant="outline" className="ui-hover min-h-9 cursor-pointer rounded-xl border-border px-2.5 text-xs transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40" onClick={() => addGenre(g)}>
                  <Plus className="w-2.5 h-2.5 mr-1" /> {g}
                </Badge>
              ))}
            </div>
          </div>

          <Button className="ui-hover mt-4 min-h-12 w-full rounded-xl bg-primary font-semibold shadow-lg shadow-primary/15 hover:bg-primary/90" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Profile
          </Button>
        </div>

        <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-xl font-bold tracking-tight sm:mb-6">
            <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
            Appearance
          </h2>
          <ChatThemeSettings
            user={user}
            onPreferenceSaved={async (themeId) => {
              await checkUserAuth();
            }}
          />
        </div>

        <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-xl font-bold tracking-tight sm:mb-6">Privacy</h2>
          <LockedChatSettings />
        </div>

        <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-xl font-bold tracking-tight sm:mb-6">Nali Presence</h2>
          <NaliProactivitySettings />
        </div>

        <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-xl font-bold tracking-tight sm:mb-6">Accessibility</h2>
          <div className="ui-surface flex flex-col items-start justify-between gap-4 rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6">
            <div>
              <label htmlFor="reduce-motion" className="font-heading font-semibold text-lg text-foreground">
                Reduce Motion
              </label>
              <p id="reduce-motion-description" className="text-sm text-muted-foreground mt-1">
                Turns off nonessential motion across the app.
                {osReducedMotion && " Your device already requests reduced motion."}
              </p>
            </div>
            <Switch
              className="shrink-0"
              id="reduce-motion"
              checked={userReducedMotion}
              onCheckedChange={setUserReducedMotion}
              aria-describedby="reduce-motion-description"
              aria-label="Reduce Motion"
            />
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-xl font-bold tracking-tight sm:mb-6">Onboarding & Tutorial</h2>
          <div className="flex flex-col gap-4">
            <div className="ui-surface flex flex-col justify-between gap-4 rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6">
              <div>
                <h3 className="font-heading font-semibold text-lg text-foreground">Interactive Tutorial</h3>
                <p className="text-sm text-muted-foreground mt-1">Take an interactive tour to learn how to use NaliBase's worlds and creative tools.</p>
              </div>
              <Button onClick={() => setShowWizard(true)} className="ui-hover min-h-11 w-full rounded-xl border-0 bg-primary font-semibold text-white hover:bg-primary/90 sm:w-auto">
                Start Tutorial
              </Button>
            </div>

            <div className="ui-surface flex flex-col justify-between gap-4 rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6">
              <div>
                <h3 className="font-heading font-semibold text-lg text-foreground">Profile Setup & Onboarding</h3>
                <p className="text-sm text-muted-foreground mt-1">Revisit the initial onboarding process to set up your profile and complete the tutorial.</p>
              </div>
              <Button variant="outline" className="ui-hover min-h-11 w-full rounded-xl border-primary/50 font-semibold text-primary hover:bg-primary/10 sm:w-auto" asChild>
                <Link to="/onboarding">
                  Restart Onboarding
                </Link>
                </Button>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-xl font-bold tracking-tight sm:mb-6">Creator Tools</h2>
          <div className="ui-surface flex flex-col justify-between gap-4 rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6">
            <div>
              <h3 className="font-heading font-semibold text-lg text-foreground">Analytics Dashboard</h3>
              <p className="text-sm text-muted-foreground mt-1">Track plays, reach, audience growth & listener engagement.</p>
            </div>
            <Button className="ui-hover min-h-11 w-full rounded-xl border-0 bg-primary font-semibold text-white hover:bg-primary/90 sm:w-auto" asChild>
              <Link to="/analytics">
                <BarChart3 className="w-4 h-4" />
                View Analytics
              </Link>
              </Button>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-xl font-bold tracking-tight sm:mb-6">Squad & Scale</h2>
          <div className="ui-surface flex flex-col justify-between gap-4 rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6">
            <div>
              <h3 className="font-heading font-semibold text-lg text-foreground">Link Up With a Partner</h3>
              <p className="text-sm text-muted-foreground mt-1">Team up with a friend — hit your weekly chat or task goals together and unlock a 1.5x weekend bonus.</p>
            </div>
            <Button className="ui-hover min-h-11 w-full rounded-xl border-0 bg-gradient-to-r from-primary to-accent font-semibold text-white sm:w-auto" asChild>
              <Link to="/squad">
                <Users className="w-4 h-4" />
                Open Squad & Scale
              </Link>
              </Button>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-xl font-bold tracking-tight sm:mb-6">Subscription & Billing</h2>
          <SubscriptionSettings />
        </div>

        <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-xl font-bold tracking-tight sm:mb-6">Audio Devices</h2>
          <DeviceSelector compact={true} />
        </div>

        {user?.role === 'admin' && (
          <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
            <h2 className="mb-5 flex items-center gap-2 font-heading text-xl font-bold tracking-tight sm:mb-6 text-orange-500">Developer Testing</h2>
            <div className="ui-surface rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5 sm:p-6">
              <h3 className="font-heading font-semibold text-lg text-orange-500 mb-2">Backend Infrastructure Testing</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Use these tools to manually trigger backend webhooks and simulate server-side events for automated testing.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="ui-hover min-h-11 w-full rounded-xl border-orange-500/50 text-orange-500 hover:bg-orange-500/20 sm:w-auto" asChild>
                  <Link to="/webhook-test">
                    Open Webhook Testing Interface
                  </Link>
                  </Button>
              </div>
            </div>
          </div>
        )}

        <DeleteAccountDialog />
      </div>
      <InteractiveWizard open={showWizard} onOpenChange={setShowWizard} />
    </PullToRefresh>
  );
}