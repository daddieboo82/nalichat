import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Play, Pause, Download, Share2, Loader2, Wand2, Music, Zap, Radio, Users } from "lucide-react";
import { motion } from "framer-motion";
import CollaboratorPresence from "@/components/studio/CollaboratorPresence";
import ExportBounce from "@/components/studio/ExportBounce";

export default function StudioEditor() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [audioUrl, setAudioUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [masterAnalysis, setMasterAnalysis] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [error, setError] = useState("");
  const audioRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // Subscribe to collaboration updates
  useEffect(() => {
    if (!activeSession || !currentUser) return;

    const handleCollaborationUpdate = () => {
      // Fetch current collaborators (in production, use WebSocket/SSE)
      setCollaborators([currentUser]);
    };

    const interval = setInterval(handleCollaborationUpdate, 1000);
    return () => clearInterval(interval);
  }, [activeSession, currentUser]);

  const handleProcessAudio = async () => {
    if (!audioUrl) return;
    setProcessing(true);
    setError("");
    try {
      const result = await base44.functions.invoke('aiMasterSession', {
        audio_url: audioUrl,
        project_title: uploadTitle || 'Untitled Mix'
      });
      setMasterAnalysis(result.data);
    } catch (err) {
      setError("Failed to process audio. Please try again.");
      console.error('Processing failed:', err);
    }
    setProcessing(false);
  };

  const handleUploadToLeaderboard = async () => {
    if (!audioUrl || !uploadTitle || !currentUser) return;
    
    try {
      await base44.entities.ArtPost.create({
        title: uploadTitle,
        description: masterAnalysis?.recommendations || 'AI-mastered session',
        file_url: audioUrl,
        medium: 'production',
        creator_id: currentUser.id,
        creator_name: currentUser.full_name,
        creator_avatar: currentUser.avatar_url,
        featured: false,
        likes: 0,
        views: 0,
        genre: 'Electronic'
      });
      setShareDialog(false);
      setAudioUrl("");
      setUploadTitle("");
      setMasterAnalysis(null);
      setError("");
    } catch (err) {
      setError("Failed to upload. Please try again.");
      console.error('Upload failed:', err);
    }
  };

  const handleShare = async (platform) => {
    if (!currentUser) return;
    
    // Create share message
    const shareText = `Check out my latest mix: ${uploadTitle} - mastered with AI!`;
    
    if (platform === 'messages') {
      // Store in local state for later sharing via messages
      console.log('Share via messages:', shareText);
    }
    
    setShareDialog(false);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs defaultValue="editor" className="h-full flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-border px-6 py-3 h-auto bg-card/50">
          <TabsTrigger value="editor" className="rounded-lg">Studio Editor</TabsTrigger>
          <TabsTrigger value="mastering" className="rounded-lg">AI Mastering</TabsTrigger>
          <TabsTrigger value="library" className="rounded-lg">Processed Sessions</TabsTrigger>
        </TabsList>

        {/* Editor Tab */}
        <TabsContent value="editor" className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-card rounded-2xl border border-border p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-heading font-bold text-2xl">Award-Winning Studio Editor</h2>
                    <span className="text-xs px-3 py-1 rounded-full bg-accent/20 text-accent font-semibold">Professional Grade</span>
                  </div>
                  <p className="text-muted-foreground">Professional mastering-grade tools with streaming platform optimization</p>
                </div>
                {collaborators.length > 0 && (
                  <CollaboratorPresence collaborators={collaborators} currentUserId={currentUser?.id} />
                )}
              </div>

              <div className="space-y-4">
                <Input
                  placeholder="Session title (e.g., 'Summer Vibes - v2')"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="rounded-xl"
                />
                
                <Input
                  placeholder="Audio URL from bounced session"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="rounded-xl"
                />

                {audioUrl && (
                  <div className="flex items-center gap-2 p-4 bg-secondary/50 rounded-xl">
                    <div className="flex-1 flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (audioRef.current) {
                            playing ? audioRef.current.pause() : audioRef.current.play();
                            setPlaying(!playing);
                          }
                        }}
                        className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors"
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
                   className="w-full rounded-xl bg-primary hover:bg-primary/90"
                 >
                   {processing ? (
                     <>
                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                       AI is processing...
                     </>
                   ) : (
                     <>
                       <Wand2 className="w-4 h-4 mr-2" />
                       Analyze & Master with AI
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
                className="bg-card rounded-2xl border border-accent/30 p-8 space-y-4"
              >
                <div className="flex items-center gap-2 mb-4">
                   <Zap className="w-5 h-5 text-accent" />
                   <h3 className="font-heading font-bold text-lg">AI Mastering Analysis</h3>
                   <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent font-semibold">Industry Standard</span>
                 </div>

                <div className="grid gap-4">
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">EQ & Tone</p>
                    <p className="text-sm">{masterAnalysis.eq_recommendations}</p>
                  </div>
                  
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Compression</p>
                    <p className="text-sm">{masterAnalysis.compression_settings}</p>
                  </div>
                  
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Effects & Reverb</p>
                    <p className="text-sm">{masterAnalysis.effects_chain}</p>
                  </div>
                  
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Target Loudness</p>
                    <p className="text-sm">{masterAnalysis.target_loudness}</p>
                  </div>
                  
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Mastering Chain</p>
                    <p className="text-sm">{masterAnalysis.mastering_chain}</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                   <Dialog open={shareDialog} onOpenChange={setShareDialog}>
                     <DialogTrigger asChild>
                       <Button className="flex-1 rounded-xl bg-accent hover:bg-accent/90">
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
                     audioUrl={audioUrl}
                     title={uploadTitle}
                     disabled={!audioUrl}
                   />
                 </div>
              </motion.div>
            )}
          </div>
        </TabsContent>

        {/* Mastering Tab */}
         <TabsContent value="mastering" className="flex-1 overflow-auto p-6">
           <div className="max-w-4xl mx-auto text-center text-muted-foreground py-20">
             <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
             <p className="font-heading font-semibold mb-2 text-foreground">AI Mastering Engine</p>
             <p className="text-sm opacity-70">Upload an audio session in the Editor tab to analyze and apply professional mastering</p>
           </div>
         </TabsContent>

        {/* Library Tab */}
         <TabsContent value="library" className="flex-1 overflow-auto p-6">
           <div className="max-w-4xl mx-auto text-center text-muted-foreground py-20">
             <Music className="w-12 h-12 mx-auto mb-4 opacity-30" />
             <p className="font-heading font-semibold mb-2 text-foreground">Your Processed Sessions</p>
             <p className="text-sm opacity-70">Sessions you process and publish will be saved here for easy access</p>
           </div>
         </TabsContent>
      </Tabs>
    </div>
  );
}