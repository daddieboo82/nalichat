import { secureUploadFile } from "@/lib/secureUpload";
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
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setTracksLoading(true);
    setTracksError(false);
    base44.entities.ArtPost.filter({ creator_id: user.id }, "-created_date", 25)
      .then((tracks) => {
        if (!cancelled) setMyTracks(tracks || []);
      })
      .catch(() => {
        if (!cancelled) {
          setMyTracks([]);
          setTracksError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setTracksLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, user]);

  const reset = () => {
    setRemixName(""); setDescription(""); setSelectedTrackId(""); setFile(null); setLinkUrl(""); setTab("studio");
  };

  const handleSubmit = async () => {
    if (!remixName.trim()) return toast.error("Give your remix a name.");
    setSubmitting(true);
    try {
      let source_type = "";
      let remix_file_url = "";
      let external_url = "";
      let file_format = "";
      let file_size = 0;
      let source_post_id = "";

      if (tab === "studio") {
        const track = myTracks.find((t) => t.id === selectedTrackId);
        if (!track) {
          toast.error("Select one of your tracks.");
          setSubmitting(false);
          return;
        }
        source_type = "nalichat_studio";
        source_post_id = track.id;
      } else if (tab === "external") {
        if (!file) {
          toast.error("Choose a file to upload.");
          setSubmitting(false);
          return;
        }
        if (file.size > 100 * 1024 * 1024) {
          toast.error("Remix files must be 100MB or smaller.");
          setSubmitting(false);
          return;
        }
        file_format = (file.name.split(".").pop() || "").toLowerCase();
        if (!["mp3", "wav"].includes(file_format)) {
          toast.error("Only MP3 and WAV files are supported.");
          setSubmitting(false);
          return;
        }
        const { file_url } = await secureUploadFile({ file });
        remix_file_url = file_url;
        file_size = file.size;
        source_type = "external_upload";
      } else {
        if (!linkUrl.trim()) {
          toast.error("Paste a link to your remix.");
          setSubmitting(false);
          return;
        }
        external_url = linkUrl.trim();
        source_type = "link_import";
      }

      const res = await base44.functions.invoke("submitChallengeRemix", {
        challenge_id: challenge.id,
        remix_name: remixName.trim(),
        description: description.trim(),
        source_type,
        source_post_id,
        remix_file_url,
        external_url,
        file_format: file_format || undefined,
        file_size,
        device_type: detectDevice(),
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const submission = res?.data?.submission;

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
              {tracksLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : tracksError ? (
                <p className="text-sm text-destructive" role="alert">Couldn't load your published tracks. Close and reopen this dialog to retry.</p>
              ) : myTracks.length === 0 ? (
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
                accept=".mp3,.wav"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm rounded-xl border border-border p-2 file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5"
              />
              {file && <p className="text-xs text-muted-foreground truncate">{file.name}</p>}
              <p className="text-xs text-muted-foreground">.mp3, .wav — up to 100MB</p>
            </TabsContent>

            <TabsContent value="link" className="space-y-2 pt-3">
              <Input placeholder="https://soundcloud.com/... or Drive/Dropbox link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="rounded-xl" />
              <p className="text-xs text-muted-foreground">Linked file should be MP3 or WAV</p>
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