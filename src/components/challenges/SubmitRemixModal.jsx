import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, UploadCloud, Music2, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

function detectDevice() {
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

export default function SubmitRemixModal({ open, onOpenChange, challenge, user, onSubmitted }) {
  const [tab, setTab] = useState("studio");
  const [remixName, setRemixName] = useState("");
  const [description, setDescription] = useState("");
  const [myTracks, setMyTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [file, setFile] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && user) {
      base44.entities.ArtPost.filter({ creator_id: user.id }, "-created_date", 25).then(setMyTracks).catch(() => {});
    }
  }, [open, user]);

  const reset = () => {
    setRemixName(""); setDescription(""); setSelectedTrackId(""); setFile(null); setLinkUrl(""); setTab("studio");
  };

  const handleSubmit = async () => {
    if (!remixName.trim()) return toast.error("Give your remix a name.");
    setSubmitting(true);
    try {
      let remix_file_url = "", source_type = "", file_format = "", external_url = "";

      if (tab === "studio") {
        const track = myTracks.find((t) => t.id === selectedTrackId);
        if (!track) { toast.error("Select one of your tracks."); setSubmitting(false); return; }
        remix_file_url = track.file_url;
        source_type = "nalichat_studio";
      } else if (tab === "external") {
        if (!file) { toast.error("Choose a file to upload."); setSubmitting(false); return; }
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        remix_file_url = file_url;
        source_type = "external_upload";
        file_format = (file.name.split(".").pop() || "").toLowerCase();
      } else {
        if (!linkUrl.trim()) { toast.error("Paste a link to your remix."); setSubmitting(false); return; }
        remix_file_url = linkUrl.trim();
        external_url = linkUrl.trim();
        source_type = "link_import";
      }

      const submission = await base44.entities.ChallengeSubmission.create({
        challenge_id: challenge.id,
        producer_id: user.id,
        producer_name: user.full_name || user.email,
        producer_avatar: user.avatar_url,
        remix_file_url,
        remix_name: remixName.trim(),
        description: description.trim(),
        source_type,
        external_url,
        file_format: file_format || undefined,
        device_type: detectDevice(),
        status: "approved",
      });

      toast.success("Remix submitted! Good luck 🎧");
      reset();
      onOpenChange(false);
      onSubmitted?.(submission);
    } catch (err) {
      toast.error(err.message || "Failed to submit remix");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="bg-card border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Submit Your Remix</DialogTitle>
          <DialogDescription>Choose how you want to submit to "{challenge.title}"</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input placeholder="Remix name" value={remixName} onChange={(e) => setRemixName(e.target.value)} disabled={submitting} className="rounded-xl" />
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} disabled={submitting} className="rounded-xl" />

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="studio"><Music2 className="w-4 h-4 mr-1" /> Studio</TabsTrigger>
              <TabsTrigger value="external"><UploadCloud className="w-4 h-4 mr-1" /> Upload</TabsTrigger>
              <TabsTrigger value="link"><Link2 className="w-4 h-4 mr-1" /> Link</TabsTrigger>
            </TabsList>

            <TabsContent value="studio" className="space-y-2 pt-3">
              {myTracks.length === 0 ? (
                <p className="text-sm text-muted-foreground">You have no published tracks yet. Bounce one in the Studio first.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {myTracks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTrackId(t.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-sm ${selectedTrackId === t.id ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="external" className="space-y-2 pt-3">
              <input
                type="file"
                accept=".wav,.mp3,.flac,.aiff,audio/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm rounded-xl border border-border p-2 file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5"
              />
              {file && <p className="text-xs text-muted-foreground truncate">{file.name}</p>}
              <p className="text-xs text-muted-foreground">.wav, .mp3, .flac, .aiff — up to 100MB</p>
            </TabsContent>

            <TabsContent value="link" className="space-y-2 pt-3">
              <Input placeholder="https://soundcloud.com/... or Drive/Dropbox link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="rounded-xl" />
            </TabsContent>
          </Tabs>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent text-white">
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : "Submit Remix"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}