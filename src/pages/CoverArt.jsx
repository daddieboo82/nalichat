import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Image as ImageIcon, Music, Loader2, Save, Wand2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

export default function CoverArt() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatingStatus, setGeneratingStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["myArtPosts", currentUser?.id],
    queryFn: () => currentUser ? base44.entities.ArtPost.filter({ creator_id: currentUser.id }) : [],
    enabled: !!currentUser,
  });

  const generateArtMutation = useMutation({
    mutationFn: async (post) => {
      setGeneratingStatus("Listening to your track...");
      let transcript = "No lyrics available.";
      if (post.file_url) {
        try {
          const transRes = await base44.integrations.Core.TranscribeAudio({ audio_url: post.file_url });
          transcript = transRes || transcript;
        } catch (e) {
          console.error("Transcription failed", e);
        }
      }

      setGeneratingStatus("Designing unique cover art concept...");
      const prompt = `You are a visionary, avant-garde album cover designer. 
Analyze the following track details:
Title: ${post.title || 'Untitled'}
Genre: ${post.genre || 'Unknown'}
Tags: ${post.tags ? post.tags.join(', ') : 'None'}
Lyrics/Vibe: ${transcript}

Create a highly detailed, breathtaking, and completely unique image generation prompt for an album cover that perfectly captures the mood and themes of this track. 
CRITICAL: Do NOT include any text, typography, or words in the image itself. Focus entirely on the visual elements, lighting, style, and atmosphere. 
Respond with ONLY the raw image generation prompt string, nothing else.`;

      const aiPrompt = await base44.integrations.Core.InvokeLLM({ prompt });

      setGeneratingStatus("Painting final masterpiece...");
      const { url } = await base44.integrations.Core.GenerateImage({ prompt: aiPrompt });
      return url;
    },
    onSuccess: (url) => {
      setGeneratedImage(url);
      setGeneratingStatus("");
      toast.success("Cover art generated successfully!");
    },
    onError: (err) => {
      console.error(err);
      setGeneratingStatus("");
      toast.error("Failed to generate cover art. Please try again.");
    }
  });

  const saveArtMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPost || !generatedImage) return;
      await base44.entities.ArtPost.update(selectedPost.id, { image_url: generatedImage });
    },
    onSuccess: () => {
      toast.success("Cover art saved to track!");
      queryClient.invalidateQueries({ queryKey: ["myArtPosts"] });
      queryClient.invalidateQueries({ queryKey: ["artposts"] });
      setGeneratedImage(null);
      setSelectedPost(null);
    }
  });

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPost) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    try {
      setIsUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setGeneratedImage(file_url);
      toast.success('Image uploaded successfully! You can now save it to your track.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!currentUser) return <div className="p-8 text-center">Please log in to use the Cover Art Creator.</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-black flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" />
          AI Cover Art Creator
        </h1>
        <p className="text-muted-foreground mt-2">
          Let AI listen to your finished work and design a one-of-a-kind album cover with exclusive rights.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0">
        {/* Left: Track Selection */}
        <div className="w-full md:w-1/3 flex flex-col gap-4 border border-border bg-card rounded-xl p-4 overflow-y-auto custom-scrollbar">
          <h2 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground">Your Tracks</h2>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : posts.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground text-sm">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No tracks found. Upload a track first!
            </div>
          ) : (
            posts.map(post => (
              <div 
                key={post.id}
                onClick={() => {
                  if (generateArtMutation.isPending) return;
                  setSelectedPost(post);
                  setGeneratedImage(null);
                }}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedPost?.id === post.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
              >
                <p className="font-semibold text-sm truncate">{post.title}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{post.genre || 'No genre'} • {post.medium}</p>
              </div>
            ))
          )}
        </div>

        {/* Right: Generation Area */}
        <div className="w-full md:w-2/3 flex flex-col items-center justify-center border border-border bg-card/50 rounded-xl p-8 relative overflow-hidden">
          {!selectedPost ? (
            <div className="text-center text-muted-foreground">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Select a track to generate custom cover art.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full max-w-md">
              <div className="w-full aspect-square bg-black/50 rounded-2xl border-2 border-border overflow-hidden relative shadow-2xl flex items-center justify-center mb-6">
                {generatedImage ? (
                  <img src={generatedImage} alt="Generated cover" className="w-full h-full object-cover" />
                ) : selectedPost.image_url && !generateArtMutation.isPending ? (
                  <img src={selectedPost.image_url} alt="Current cover" className="w-full h-full object-cover opacity-50 blur-sm" />
                ) : (
                  <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
                )}

                {generateArtMutation.isPending && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                    <p className="font-heading font-semibold text-lg text-primary animate-pulse">{generatingStatus}</p>
                  </div>
                )}
              </div>

              {!generatedImage ? (
                <div className="flex gap-4 w-full">
                  <Button 
                    size="lg" 
                    className="flex-[2] h-14 text-lg gap-2 bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 shadow-lg shadow-primary/25"
                    onClick={() => generateArtMutation.mutate(selectedPost)}
                    disabled={generateArtMutation.isPending || isUploading}
                  >
                    <Wand2 className="w-5 h-5" />
                    {selectedPost.image_url ? 'Generate New' : 'Generate Cover'}
                  </Button>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                  />
                  <Button 
                    variant="outline"
                    size="lg" 
                    className="flex-1 h-14 gap-2 border-primary/50 text-primary hover:bg-primary/10"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={generateArtMutation.isPending || isUploading}
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    Upload
                  </Button>
                </div>
              ) : (
                <div className="flex gap-4 w-full">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="flex-1 h-12"
                    onClick={() => generateArtMutation.mutate(selectedPost)}
                    disabled={generateArtMutation.isPending || saveArtMutation.isPending}
                  >
                    Retry
                  </Button>
                  <Button 
                    size="lg" 
                    className="flex-1 h-12 gap-2"
                    onClick={() => saveArtMutation.mutate()}
                    disabled={saveArtMutation.isPending}
                  >
                    {saveArtMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save to Track
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}