import { secureUploadFile } from "@/lib/secureUpload";
import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, Loader2, X, Plus, BarChart3, Users, Palette } from "lucide-react";
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
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await secureUploadFile({ file });
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
      // Refresh the global auth context so the new display_name propagates
      // to the Home greeting, nav bar, and anywhere else that reads user data.
      await checkUserAuth();
      sounds.success();
      toast.success("Profile updated!");
    } catch (error) {
      console.error("Settings profile save failed:", error);
      toast.error(error?.message || "Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (authError || !user) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold">Settings unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">We couldn't verify your account. Refresh and try again.</p>
          <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
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
      <div className={`max-w-xl mx-auto p-6 py-12 ${reduceMotion ? "reduce-motion-surface" : ""}`}>
        <h1 className="text-2xl font-heading font-bold mb-8">Profile Settings</h1>

        {/* Avatar */}
        <div className="flex items-center gap-6 mb-8 bg-card/50 backdrop-blur-xl p-6 rounded-2xl border border-white/[0.06] shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/20 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
          
          <div className="relative group shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-br from-primary to-pink-500 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-500" />
            <Avatar className="w-24 h-24 rounded-full border-4 border-background relative z-10 shadow-xl">
              <AvatarImage src={form.avatar_url} className="rounded-full object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-pink-500 text-white text-3xl font-black rounded-full">
                {form.display_name?.[0]?.toUpperCase() || user.full_name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-1 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 backdrop-blur-sm cursor-pointer"
            >
              {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
            </button>
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl font-heading font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-pink-500 drop-shadow-sm">
              {form.display_name || user.full_name}
            </h2>
            <p className="text-sm font-medium text-muted-foreground mt-1 bg-background/50 px-3 py-1 rounded-full inline-block border border-border/50">
              {user.email}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Display Name / Artist Name</label>
            <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} className="bg-secondary/50 border-0 rounded-xl" placeholder="Your stage name..." />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Role</label>
            <Select value={form.artist_role} onValueChange={v => setForm(f => ({ ...f, artist_role: v }))}>
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
            <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className="bg-secondary/50 border-0 rounded-xl min-h-[120px] resize-y" placeholder="Tell others about yourself..." />
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

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-heading font-bold mb-6 flex items-center gap-2">
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

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-heading font-bold mb-6">Privacy</h2>
          <LockedChatSettings />
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-heading font-bold mb-6">Nali Presence</h2>
          <NaliProactivitySettings />
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-heading font-bold mb-6">Accessibility</h2>
          <div className="bg-card/50 backdrop-blur-xl rounded-2xl p-6 flex items-center justify-between gap-4 border border-white/[0.06]">
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
              id="reduce-motion"
              checked={userReducedMotion}
              onCheckedChange={setUserReducedMotion}
              aria-describedby="reduce-motion-description"
              aria-label="Reduce Motion"
            />
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-heading font-bold mb-6">Onboarding & Tutorial</h2>
          <div className="flex flex-col gap-4">
            <div className="bg-card/50 backdrop-blur-xl rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/[0.06]">
              <div>
                <h3 className="font-heading font-semibold text-lg text-foreground">Interactive Tutorial</h3>
                <p className="text-sm text-muted-foreground mt-1">Take an interactive tour to learn how to use NaliChat's studio and collaboration tools.</p>
              </div>
              <Button onClick={() => setShowWizard(true)} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white border-0 font-semibold">
                Start Tutorial
              </Button>
            </div>

            <div className="bg-card/50 backdrop-blur-xl rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/[0.06]">
              <div>
                <h3 className="font-heading font-semibold text-lg text-foreground">Profile Setup & Onboarding</h3>
                <p className="text-sm text-muted-foreground mt-1">Revisit the initial onboarding process to set up your profile and complete the tutorial.</p>
              </div>
              <Button variant="outline" className="w-full sm:w-auto border-primary/50 text-primary hover:bg-primary/10 font-semibold" asChild>
                <Link to="/onboarding">
                  Restart Onboarding
                </Link>
                </Button>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-heading font-bold mb-6">Creator Tools</h2>
          <div className="bg-card/50 backdrop-blur-xl rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/[0.06]">
            <div>
              <h3 className="font-heading font-semibold text-lg text-foreground">Analytics Dashboard</h3>
              <p className="text-sm text-muted-foreground mt-1">Track plays, reach, audience growth & listener engagement.</p>
            </div>
            <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white border-0 gap-2 font-semibold" asChild>
              <Link to="/analytics">
                <BarChart3 className="w-4 h-4" />
                View Analytics
              </Link>
              </Button>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-heading font-bold mb-6">Squad & Scale</h2>
          <div className="bg-card/50 backdrop-blur-xl rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/[0.06]">
            <div>
              <h3 className="font-heading font-semibold text-lg text-foreground">Link Up With a Partner</h3>
              <p className="text-sm text-muted-foreground mt-1">Team up with a friend — hit your weekly chat or task goals together and unlock a 1.5x weekend bonus.</p>
            </div>
            <Button className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent text-white border-0 gap-2 font-semibold" asChild>
              <Link to="/squad">
                <Users className="w-4 h-4" />
                Open Squad & Scale
              </Link>
              </Button>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-heading font-bold mb-6">Subscription & Billing</h2>
          <SubscriptionSettings />
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-heading font-bold mb-6">Audio Devices</h2>
          <DeviceSelector compact={true} />
        </div>

        {user?.role === 'admin' && (
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-heading font-bold mb-6 text-orange-500">Developer Testing</h2>
            <div className="bg-orange-500/10 rounded-2xl p-6 border border-orange-500/30">
              <h3 className="font-heading font-semibold text-lg text-orange-500 mb-2">Backend Infrastructure Testing</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Use these tools to manually trigger backend webhooks and simulate server-side events for automated testing.
              </p>
              <div className="flex gap-4">
                <Button variant="outline" className="border-orange-500/50 text-orange-500 hover:bg-orange-500/20" asChild>
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