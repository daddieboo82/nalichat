import { secureUploadFile } from "@/lib/secureUpload";
import { validateUpload } from "@/lib/uploadValidation";
import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Loader2, Image as ImageIcon, ArrowLeft, Upload, Music, X } from "lucide-react";
import { toast } from "sonner";
import DateField from "@/components/challenges/DateField";

const GENRES = ["EDM", "Hip Hop", "R&B", "Pop", "Rock", "Lo-Fi", "Ambient", "Other"];
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const KEYS = NOTES.flatMap((n) => [`${n} Major`, `${n} Minor`]);

export default function CreateChallenge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", description: "", genre: "", bpm: "", key: "",
    rules: "", prize_description: "",
    start_date: "", submission_end_date: "", voting_end_date: "",
  });
  const [sourceTrackFile, setSourceTrackFile] = useState(null);
  const [sourceTrackName, setSourceTrackName] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const identityGenerationRef = useRef(0);

  useEffect(() => {
    identityGenerationRef.current += 1;
    setForm({
      title: "", description: "", genre: "", bpm: "", key: "",
      rules: "", prize_description: "",
      start_date: "", submission_end_date: "", voting_end_date: "",
    });
    setSourceTrackFile(null);
    setSourceTrackName("");
    setCoverFile(null);
    setCoverPreview(null);
    setSubmitting(false);
  }, [user?.id]);

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const handleCover = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const validation = validateUpload(f, { accept: "image" });
    if (!validation.ok) {
      toast.error(validation.error);
      e.target.value = "";
      return;
    }
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const canSubmit = form.title.trim() && form.description.trim() && sourceTrackFile && !submitting;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    const identityGeneration = identityGenerationRef.current;
    setSubmitting(true);
    try {
      const sourceExt = (sourceTrackFile.name.split(".").pop() || "").toLowerCase();
      if (!["mp3", "wav"].includes(sourceExt)) {
        toast.error("Challenge source tracks must be MP3 or WAV.");
        return;
      }
      const sourceValidation = validateUpload(sourceTrackFile);
      if (!sourceValidation.ok) {
        toast.error(sourceValidation.error);
        return;
      }

      let cover_url = "";
      if (coverFile) {
        const res = await secureUploadFile({ file: coverFile });
        if (identityGeneration !== identityGenerationRef.current) return;
        cover_url = res.file_url;
      }

      const trackRes = await secureUploadFile({ file: sourceTrackFile });
      if (identityGeneration !== identityGenerationRef.current) return;
      const source_track_url = trackRes.file_url;
      const source_track_name = sourceTrackName.trim() || sourceTrackFile.name.replace(/\.[^/.]+$/, "");

      const res = await base44.functions.invoke("createChallenge", {
        title: form.title.trim(),
        description: form.description.trim(),
        genre: form.genre || undefined,
        bpm: form.bpm ? Number(form.bpm) : undefined,
        key: form.key || undefined,
        rules: form.rules || undefined,
        prize_description: form.prize_description || undefined,
        cover_url: cover_url || undefined,
        source_track_url,
        source_track_name,
        start_date: form.start_date || undefined,
        submission_end_date: form.submission_end_date || undefined,
        voting_end_date: form.voting_end_date || undefined,
      });
      if (identityGeneration !== identityGenerationRef.current) return;
      if (res?.data?.error) throw new Error(res.data.error);
      const challenge = res?.data?.challenge;
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "create_challenge" ||
        res?.data?.userId !== user.id ||
        !challenge?.id ||
        challenge.host_artist_id !== user.id
      ) {
        throw new Error("Challenge creation was not confirmed");
      }

      toast.success("Challenge created!");
      navigate(`/challenge/${challenge.id}`);
    } catch (err) {
      if (identityGeneration === identityGenerationRef.current) {
        console.error(err);
        toast.error(err?.message || "Couldn't create challenge. Please try again.");
      }
    } finally {
      if (identityGeneration === identityGenerationRef.current) setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-5 pb-[max(6rem,env(safe-area-inset-bottom))] sm:p-6 sm:space-y-6 lg:pb-20">
      <Link to="/challenges" className="ui-hover inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40">
        <ArrowLeft className="w-4 h-4" /> Back to Challenges
      </Link>

      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-gradient-animate sm:text-3xl">Create a Remix Challenge</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload a source track and let the community remix it.</p>
      </div>

      <div className="ui-surface space-y-4 rounded-3xl border border-white/[0.06] bg-card/40 p-4 sm:p-5">
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Cover Image</label>
          <div
            className="ui-hover relative flex items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary/40"
            style={{ height: coverPreview ? "180px" : "96px" }}
          >
            <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleCover} />
            <div className="pointer-events-none relative z-0 w-full h-full flex items-center justify-center">
              {coverPreview ? (
                <img src={coverPreview} className="w-full h-full object-cover" alt="cover preview" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                  <p className="text-sm">Click to upload cover image</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="challenge-title" className="text-xs text-muted-foreground mb-1.5 block">Title *</label>
          <Input
            id="challenge-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Summer Vibes Remix Challenge"
            className="h-11 rounded-xl border border-border/50 bg-secondary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label htmlFor="challenge-description" className="text-xs text-muted-foreground mb-1.5 block">Description *</label>
          <Textarea
            id="challenge-description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What are you looking for? Describe the vibe..."
            rows={4}
            className="resize-none rounded-xl border border-border/50 bg-secondary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Genre</label>
            <Select value={form.genre} onValueChange={(v) => setForm((f) => ({ ...f, genre: v }))}>
              <SelectTrigger className="h-11 rounded-xl border border-border/50 bg-secondary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"><SelectValue placeholder="Select genre" /></SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="challenge-bpm" className="text-xs text-muted-foreground mb-1.5 block">BPM</label>
            <Input
              id="challenge-bpm"
              type="number"
              value={form.bpm}
              onChange={(e) => setForm((f) => ({ ...f, bpm: e.target.value }))}
              placeholder="e.g. 120"
              className="h-11 rounded-xl border border-border/50 bg-secondary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Key</label>
          <Select value={form.key} onValueChange={(v) => setForm((f) => ({ ...f, key: v }))}>
            <SelectTrigger className="h-11 rounded-xl border border-border/50 bg-secondary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"><SelectValue placeholder="Select key" /></SelectTrigger>
            <SelectContent>
              {KEYS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Source Track *</label>
          <div className="space-y-2">
            <div
              className="ui-hover relative flex min-h-24 items-center justify-center rounded-2xl border-2 border-dashed border-border px-3 transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary/40"
              onClick={() => !sourceTrackFile && document.getElementById("source-track-input").click()}
            >
              <input
                id="source-track-input"
                type="file"
                accept=".mp3,.wav"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (!/\.(mp3|wav)$/i.test(f.name)) {
                      toast.error("Only MP3 or WAV files are allowed.");
                      e.target.value = "";
                      return;
                    }
                    setSourceTrackFile(f);
                    if (!sourceTrackName) setSourceTrackName(f.name.replace(/\.[^/.]+$/, ""));
                  }
                }}
              />
              <div className="text-center text-muted-foreground pointer-events-none">
                <Upload className="w-5 h-5 mx-auto mb-1 opacity-40" />
                <p className="text-sm">{sourceTrackFile ? sourceTrackFile.name : "Click to upload source track (MP3/WAV)"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-primary shrink-0" />
              <Input
                value={sourceTrackName}
                onChange={(e) => setSourceTrackName(e.target.value)}
                placeholder="Track name"
                className="h-11 rounded-xl border border-border/50 bg-secondary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
              {sourceTrackFile && (
                <button type="button" onClick={() => { setSourceTrackFile(null); }} className="ui-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/30" aria-label="Remove source track">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="challenge-rules" className="text-xs text-muted-foreground mb-1.5 block">Rules</label>
          <Textarea
            id="challenge-rules"
            value={form.rules}
            onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))}
            placeholder="Remix must incorporate elements from the source track..."
            rows={3}
            className="resize-none rounded-xl border border-border/50 bg-secondary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label htmlFor="challenge-prize" className="text-xs text-muted-foreground mb-1.5 block">Prize Description</label>
          <Textarea
            id="challenge-prize"
            value={form.prize_description}
            onChange={(e) => setForm((f) => ({ ...f, prize_description: e.target.value }))}
            placeholder="What does the winner get?"
            rows={2}
            className="resize-none rounded-xl border border-border/50 bg-secondary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DateField label="Start Date" value={form.start_date} onChange={(v) => setForm((f) => ({ ...f, start_date: v }))} />
          <DateField label="Submissions Close" value={form.submission_end_date} onChange={(v) => setForm((f) => ({ ...f, submission_end_date: v }))} />
          <DateField label="Voting Closes" value={form.voting_end_date} onChange={(v) => setForm((f) => ({ ...f, voting_end_date: v }))} />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="ui-hover h-12 w-full rounded-xl bg-gradient-to-r from-primary to-accent text-base font-semibold text-white shadow-lg shadow-primary/10"
      >
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create Challenge"}
      </Button>
    </div>
  );
}