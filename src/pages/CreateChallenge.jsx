import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Loader2, Image as ImageIcon, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import StemUploadList from "@/components/challenges/StemUploadList";
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
  const [stems, setStems] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCover = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const canSubmit = form.title.trim() && form.description.trim() && !submitting;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      let cover_url = "";
      if (coverFile) {
        const res = await base44.integrations.Core.UploadFile({ file: coverFile });
        cover_url = res.file_url;
      }

      const stem_file_urls = [];
      const stem_names = [];
      for (const stem of stems) {
        const res = await base44.integrations.Core.UploadFile({ file: stem.file });
        stem_file_urls.push(res.file_url);
        stem_names.push(stem.name || stem.file.name);
      }

      const now = new Date();
      const status = form.start_date && new Date(form.start_date) > now ? "upcoming" : "active";

      const challenge = await base44.entities.Challenge.create({
        title: form.title.trim(),
        description: form.description.trim(),
        host_artist_id: user.id,
        host_artist_name: user.full_name || user.display_name || user.email,
        genre: form.genre || undefined,
        bpm: form.bpm ? Number(form.bpm) : undefined,
        key: form.key || undefined,
        rules: form.rules || undefined,
        prize_description: form.prize_description || undefined,
        cover_url: cover_url || undefined,
        stem_file_urls,
        stem_names,
        status,
        start_date: form.start_date || undefined,
        submission_end_date: form.submission_end_date || undefined,
        voting_end_date: form.voting_end_date || undefined,
      });

      toast.success("Challenge created!");
      navigate(`/challenge/${challenge.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create challenge. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <Link to="/challenges" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Challenges
      </Link>

      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gradient-animate">Create a Remix Challenge</h1>
        <p className="text-muted-foreground text-sm mt-1">Drop your stems and let the community remix your track.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Cover Image</label>
          <div
            className="relative border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center"
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
            className="bg-secondary/50 border-0 rounded-xl h-11"
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
            className="bg-secondary/50 border-0 rounded-xl resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Genre</label>
            <Select value={form.genre} onValueChange={(v) => setForm((f) => ({ ...f, genre: v }))}>
              <SelectTrigger className="bg-secondary/50 border-0 rounded-xl h-11"><SelectValue placeholder="Select genre" /></SelectTrigger>
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
              className="bg-secondary/50 border-0 rounded-xl h-11"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Key</label>
          <Select value={form.key} onValueChange={(v) => setForm((f) => ({ ...f, key: v }))}>
            <SelectTrigger className="bg-secondary/50 border-0 rounded-xl h-11"><SelectValue placeholder="Select key" /></SelectTrigger>
            <SelectContent>
              {KEYS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Stem Files</label>
          <StemUploadList stems={stems} onChange={setStems} />
        </div>

        <div>
          <label htmlFor="challenge-rules" className="text-xs text-muted-foreground mb-1.5 block">Rules</label>
          <Textarea
            id="challenge-rules"
            value={form.rules}
            onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))}
            placeholder="Any specific rules for remixers..."
            rows={3}
            className="bg-secondary/50 border-0 rounded-xl resize-none"
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
            className="bg-secondary/50 border-0 rounded-xl resize-none"
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
        className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-white h-12 text-base"
      >
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create Challenge"}
      </Button>
    </div>
  );
}