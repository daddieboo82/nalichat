import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Play, Pause, Share2, Loader2, Wand2, Music, Zap, Radio } from "lucide-react";
import { motion } from "framer-motion";
import ExportBounce from "@/components/studio/ExportBounce";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function StudioEditor() {
  const { hasEntitlement } = useSubscription();
  const canUseAi = hasEntitlement("ai.standard");
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [audioUrl, setAudioUrl] = useState("");
  const [publishedPostId, setPublishedPostId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [masterAnalysis, setMasterAnalysis] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [error, setError] = useState("");
  const audioRef = useRef(null);


  const handleProcessAudio = async () => {
    if (!canUseAi) {
      setError("AI mastering is available with Premium. You can keep editing and export without AI mastering.");
      return;
    }
    if (!audioUrl) return;
    setProcessing(true);
    setError("");
    try {
      const result = await base44.functions.invoke('aiMasterSession', {
        project_title: uploadTitle || 'Untitled Mix'
      });
      if (result?.data?.error) throw new Error(result.data.error);
      if (!result?.data?.compressor || !result?.data?.low_shelf || !result?.data?.high_shelf) {
        throw new Error("AI mastering response was incomplete");
      }
      setMasterAnalysis(result.data);
    } catch (err) {
      setError("Failed to process audio. Please try again.");
      console.error('Processing failed:', err);
    }
    setProcessing(false);
  };

  const handleUploadToLeaderboard = async () => {
    if (!audioUrl || !uploadTitle || !currentUser) return;
    const publishingUserId = currentUser.id;
    
    try {
      const published = await base44.functions.invoke("createArtPost", {
        title: uploadTitle,
        description: masterAnalysis?.notes || 'AI-mastered session',
        file_url: audioUrl,
        medium: 'production',
        is_explicit: false,
        genre: 'Electronic'
      });
      if (published?.data?.error) throw new Error(published.data.error);
      const post = published?.data?.post;
      if (
        published?.data?.success !== true ||
        published?.data?.action !== "create_art_post" ||
        published?.data?.userId !== publishingUserId ||
        published?.data?.postId !== post?.id ||
        post?.creator_id !== publishingUserId
      ) throw new Error("Track publish was not confirmed");
      setPublishedPostId(post.id);
      setShareDialog(false);
      setError("");
    } catch (err) {
      setError("Failed to upload. Please try again.");
      console.error('Upload failed:', err);
    }
  };

  const handleShare = (platform) => {
    if (!currentUser) return;
    const shareText = `Check out my latest mix: ${uploadTitle} - mastered with AI!`;
    if (platform === 'messages') {
      setShareDialog(false);
      navigate('/messages', { state: { composeText: shareText } });
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs defaultValue="editor" className="h-full flex flex-col">
        <TabsList className="no-scrollbar w-full shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-border/70 bg-card/80 px-3 py-2.5 backdrop-blur-xl sm:px-6 sm:py-3">
          <TabsTrigger value="editor" className="min-h-10 shrink-0 rounded-xl px-3 sm:px-4">Studio Editor</TabsTrigger>
          <TabsTrigger value="mastering" className="min-h-10 shrink-0 rounded-xl px-3 sm:px-4">AI Mastering</TabsTrigger>
          <TabsTrigger value="library" className="min-h-10 shrink-0 rounded-xl px-3 sm:px-4">Processed Sessions</TabsTrigger>
        </TabsList>

        {/* Editor Tab */}
        <TabsContent value="editor" className="flex-1 overflow-auto px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="ui-surface rounded-3xl border border-border/80 bg-card p-5 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                    <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">Studio Mastering Editor</h2>
                    <span className="text-xs px-3 py-1 rounded-full bg-accent/20 text-accent font-semibold">AI Mastering</span>
                  </div>
                  <p className="text-muted-foreground">Preview a bounced mix, get AI mastering settings, and publish when you are ready.</p>
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  placeholder="Session title (e.g., 'Summer Vibes - v2')"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="h-12 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
                
                <Input
                  placeholder="Audio URL from bounced session"
                  value={audioUrl}
                  onChange={(e) => {
                    setAudioUrl(e.target.value);
                    setPublishedPostId(null);
                  }}
                  className="h-12 rounded-xl border-border/70 bg-background/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />

                {audioUrl && (
                  <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-secondary/40 p-3 sm:p-4">
                    <div className="flex-1 flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!audioRef.current) return;
                          if (playing) {
                            audioRef.current.pause();
                            setPlaying(false);
                            return;
                          }
                          try {
                            await audioRef.current.play();
                            setPlaying(true);
                          } catch (error) {
                            console.error("Studio Editor preview failed:", error);
                            setPlaying(false);
                            toast.error("Couldn't preview this audio. Please try again.");
                          }
                        }}
                        className="ui-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary hover:bg-primary/30 focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={playing ? "Pause audio preview" : "Play audio preview"}
                      >
                        {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>
                      <span className="text-sm text-muted-foreground">Preview audio</span>
                    </div>
                    <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
                  </div>
                )}

                <Button
                   onClick={handleProcessAudio}
                   disabled={!audioUrl || processing}
                   className="ui-hover min-h-12 w-full rounded-xl bg-primary font-semibold hover:bg-primary/90 shadow-lg shadow-primary/15"
                 >
                   {processing ? (
                     <>
                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                       AI is processing...
                     </>
                   ) : (
                     <>
                       <Wand2 className="w-4 h-4 mr-2" />
                       Analyze with AI
                     </>
                   )}
                 </Button>

                {error && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                    {error}
                  </div>
                )}
                </div>
                </div>

            {masterAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="ui-surface space-y-4 rounded-3xl border border-accent/30 bg-card p-5 sm:p-8"
              >
                <div className="flex items-center gap-2 mb-4">
                   <Zap className="w-5 h-5 text-accent" />
                   <h3 className="font-heading font-bold text-lg">AI Mastering Analysis</h3>
                   <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent font-semibold">AI Suggested</span>
                 </div>

                <div className="grid gap-4">
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">EQ & Tone</p>
                    <p className="text-sm">
                      Low shelf {masterAnalysis.low_shelf.gain_db >= 0 ? "+" : ""}{masterAnalysis.low_shelf.gain_db} dB @ {masterAnalysis.low_shelf.freq_hz} Hz ·
                      Presence {masterAnalysis.presence.gain_db >= 0 ? "+" : ""}{masterAnalysis.presence.gain_db} dB @ {masterAnalysis.presence.freq_hz} Hz ·
                      High shelf {masterAnalysis.high_shelf.gain_db >= 0 ? "+" : ""}{masterAnalysis.high_shelf.gain_db} dB @ {masterAnalysis.high_shelf.freq_hz} Hz
                    </p>
                  </div>
                  
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Compression</p>
                    <p className="text-sm">
                      Threshold {masterAnalysis.compressor.threshold_db} dB · Ratio {masterAnalysis.compressor.ratio}:1 ·
                      Attack {Math.round(masterAnalysis.compressor.attack_s * 1000)} ms · Release {Math.round(masterAnalysis.compressor.release_s * 1000)} ms
                    </p>
                  </div>
                  
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Output</p>
                    <p className="text-sm">
                      Makeup gain {masterAnalysis.makeup_gain_db >= 0 ? "+" : ""}{masterAnalysis.makeup_gain_db} dB ·
                      Limiter ceiling {masterAnalysis.limiter_ceiling_db} dB
                    </p>
                  </div>
                  
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Engineer Notes</p>
                    <p className="text-sm">{masterAnalysis.notes || "No additional notes."}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                   <Dialog open={shareDialog} onOpenChange={setShareDialog}>
                     <DialogTrigger asChild>
                       <Button className="ui-hover min-h-11 flex-1 rounded-xl bg-accent font-semibold hover:bg-accent/90">
                         <Share2 className="w-4 h-4 mr-2" />
                         Share & Publish
                       </Button>
                     </DialogTrigger>
                     <DialogContent className="bg-card border-border">
                       <DialogHeader>
                         <DialogTitle className="font-heading">Publish Your Mix</DialogTitle>
                         <DialogDescription>Choose where to share your AI-mastered session</DialogDescription>
                       </DialogHeader>
                       <div className="space-y-3">
                         <Button
                           onClick={() => handleUploadToLeaderboard()}
                           className="w-full rounded-xl bg-primary hover:bg-primary/90"
                         >
                           <Radio className="w-4 h-4 mr-2" />
                           Upload to Leaderboard
                         </Button>
                         <Button
                           variant="outline"
                           onClick={() => handleShare('messages')}
                           className="w-full rounded-xl"
                         >
                           <Music className="w-4 h-4 mr-2" />
                           Share in Messages
                         </Button>
                       </div>
                     </DialogContent>
                   </Dialog>

                   <ExportBounce
                     postId={publishedPostId}
                     title={uploadTitle}
                     disabled={!publishedPostId}
                   />
                 </div>
              </motion.div>
            )}
          </div>
        </TabsContent>

        {/* Mastering Tab */}
        <TabsContent value="mastering" className="flex-1 overflow-auto px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="max-w-4xl mx-auto text-center text-muted-foreground py-20">
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-heading font-semibold mb-2">AI Mastering Engine</p>
            <p className="text-sm">Upload a session in the Editor tab to apply professional mastering</p>
          </div>
        </TabsContent>

        {/* Library Tab */}
        <TabsContent value="library" className="flex-1 overflow-auto px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="max-w-4xl mx-auto text-center text-muted-foreground py-20">
            <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-heading font-semibold mb-2">Your Processed Sessions</p>
            <p className="text-sm">Sessions you've processed will appear here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}