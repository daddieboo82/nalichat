import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, ArrowRight, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { sounds } from "@/hooks/use-sound";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function Onboarding() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ 
    display_name: "", 
    bio: "", 
    role: "artist", 
    location: "", 
    avatar_url: "",
    onboarding_completed: true 
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u.onboarding_completed) {
        navigate("/");
      }
      setForm(f => ({
        ...f,
        display_name: u.display_name || u.full_name || "",
        bio: u.bio || "",
        role: u.role || "artist",
        location: u.location || "",
        avatar_url: u.avatar_url || ""
      }));
    });
  }, [navigate]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, avatar_url: file_url }));
    } catch (error) {
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.display_name) {
      toast.error("Display name is required");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.updateMe(form);
      sounds.success();
      toast.success("Welcome to NaliChat!");
      navigate("/");
    } catch (error) {
      toast.error("Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-lg bg-card/60 backdrop-blur-xl border border-border/50 rounded-[2rem] p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 glow-primary">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-black mb-2">Set Up Your Profile</h1>
          <p className="text-muted-foreground">Let's get to know you better before you start creating.</p>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative group cursor-pointer">
              <Avatar className="w-24 h-24 border-4 border-card shadow-xl">
                <AvatarImage src={form.avatar_url} className="object-cover" />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                  {form.display_name?.[0] || user.full_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <ImageIcon className="w-6 h-6 text-white" />}
                <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Upload Profile Picture</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Display / Artist Name</label>
              <Input 
                value={form.display_name} 
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} 
                className="bg-secondary/50 border-0 h-12" 
                placeholder="What should we call you?"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Role</label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-0 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="artist">Artist</SelectItem>
                    <SelectItem value="producer">Producer</SelectItem>
                    <SelectItem value="engineer">Engineer</SelectItem>
                    <SelectItem value="ar">A&R</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Location</label>
                <Input 
                  value={form.location} 
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))} 
                  className="bg-secondary/50 border-0 h-12" 
                  placeholder="City, Country"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Bio</label>
              <Textarea 
                value={form.bio} 
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} 
                className="bg-secondary/50 border-0 min-h-[100px] resize-none" 
                placeholder="Tell the community about your musical journey..."
              />
            </div>
          </div>

          <Button 
            className="w-full h-14 rounded-xl text-lg font-bold bg-gradient-to-r from-primary to-accent hover:opacity-90 glow-primary transition-all mt-4" 
            onClick={handleSave} 
            disabled={loading || uploading}
          >
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Complete Setup"}
            {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}