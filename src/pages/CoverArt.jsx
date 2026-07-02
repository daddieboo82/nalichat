import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Image as ImageIcon, Music, Loader2, Save, Wand2, Upload, Download, Folder, ListMusic, Smartphone, ChevronDown, PenTool } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSubscription } from '@/hooks/useSubscription';
import UpgradeModal from '@/components/billing/UpgradeModal';

export default function CoverArt() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatingStatus, setGeneratingStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const { hasAccess, isLoading: isLoadingSub } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const importFileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showFilesDialog, setShowFilesDialog] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editOptions, setEditOptions] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    text: "",
    textColor: "#ffffff",
    textPosition: "center",
    fontFamily: "sans-serif",
    overlayScale: 30,
    overlayX: 50,
    overlayY: 50,
  });
  const [overlayImageRef, setOverlayImageRef] = useState(null);
  const [isApplyingEdits, setIsApplyingEdits] = useState(false);

  const applyEdits = async () => {
    setIsApplyingEdits(true);
    try {
      const imageUrl = generatedImage || selectedPost?.image_url;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      ctx.filter = `brightness(${editOptions.brightness}%) contrast(${editOptions.contrast}%) saturate(${editOptions.saturation}%)`;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";

      if (overlayImageRef) {
        const overlayImg = new Image();
        overlayImg.crossOrigin = "anonymous";
        overlayImg.src = overlayImageRef;
        await new Promise((resolve, reject) => {
          overlayImg.onload = resolve;
          overlayImg.onerror = reject;
        });
        const w = (canvas.width * editOptions.overlayScale) / 100;
        const h = (overlayImg.height / overlayImg.width) * w;
        const x = (canvas.width * editOptions.overlayX) / 100 - w / 2;
        const y = (canvas.height * editOptions.overlayY) / 100 - h / 2;
        ctx.drawImage(overlayImg, x, y, w, h);
      }

      if (editOptions.text) {
        ctx.fillStyle = editOptions.textColor;
        ctx.font = `bold ${canvas.height / 10}px ${editOptions.fontFamily}`;
        ctx.textAlign = "center";
        
        let y;
        if (editOptions.textPosition === "top") y = canvas.height * 0.15;
        else if (editOptions.textPosition === "bottom") y = canvas.height * 0.85;
        else y = canvas.height * 0.5;

        ctx.fillText(editOptions.text, canvas.width / 2, y);
      }

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      const file = new File([blob], "edited-cover.jpg", { type: "image/jpeg" });
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setGeneratedImage(file_url);
      setShowEditDialog(false);
      toast.success("Edits applied! Click 'Save to Track' to save changes.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to apply edits.");
    } finally {
      setIsApplyingEdits(false);
    }
  };

  const { data: sharedFiles = [], isLoading: isLoadingFiles } = useQuery({
    queryKey: ["mySharedFiles", currentUser?.id],
    queryFn: () => currentUser ? base44.entities.SharedFile.filter({ uploader_id: currentUser.id }) : [],
    enabled: showFilesDialog && !!currentUser,
  });

  const { data: myPlaylists = [], isLoading: isLoadingPlaylists } = useQuery({
    queryKey: ["myPlaylists", currentUser?.id],
    queryFn: () => currentUser ? base44.entities.Playlist.filter({ owner_id: currentUser.id }) : [],
    enabled: showPlaylistDialog && !!currentUser,
  });

  const { data: playlistTracks = [], isLoading: isLoadingPlaylistTracks } = useQuery({
    queryKey: ["playlistTracks", selectedPlaylist?.id],
    queryFn: async () => {
      if (!selectedPlaylist?.track_ids?.length) return [];
      const tracks = [];
      for (const id of selectedPlaylist.track_ids) {
        try {
           tracks.push(await base44.entities.ArtPost.get(id));
        } catch (e) {}
      }
      return tracks.filter(t => t.creator_id === currentUser.id);
    },
    enabled: !!selectedPlaylist,
  });

  const handleImportSharedFile = async (file) => {
    try {
      setIsImporting(true);
      setShowFilesDialog(false);
      toast.info('Importing track from Files...');
      await base44.entities.ArtPost.create({
        title: file.name.replace(/\.[^/.]+$/, ""),
        description: "Imported from Files",
        medium: "original",
        creator_id: currentUser.id,
        creator_name: currentUser.display_name || currentUser.full_name || "Unknown Artist",
        file_url: file.file_url,
        genre: "Unknown",
        tags: ["imported"]
      });
      queryClient.invalidateQueries({ queryKey: ["myArtPosts"] });
      toast.success("Track imported successfully!");
    } catch (error) {
      console.error(error);
      toast.error('Failed to import track');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportAudio = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;
    
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      toast.error('Please upload an audio file');
      return;
    }

    try {
      setIsImporting(true);
      toast.info('Uploading track...');
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.ArtPost.create({
        title: file.name.replace(/\.[^/.]+$/, ""),
        description: "Imported track",
        medium: "original",
        creator_id: currentUser.id,
        creator_name: currentUser.display_name || currentUser.full_name || "Unknown Artist",
        file_url: file_url,
        genre: "Unknown",
        tags: ["imported"]
      });
      queryClient.invalidateQueries({ queryKey: ["myArtPosts"] });
      toast.success("Track imported successfully!");
    } catch (error) {
      console.error(error);
      toast.error('Failed to import track');
    } finally {
      setIsImporting(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    base44.auth.me()
      .then(setCurrentUser)
      .catch(() => {})
      .finally(() => setIsLoadingUser(false));
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
      const imgRes = await base44.integrations.Core.GenerateImage({ prompt: aiPrompt });
      if (!imgRes || !imgRes.url) throw new Error("Image generation failed");
      return imgRes.url;
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

  const handleDownload = async () => {
    const imageUrl = generatedImage || selectedPost?.image_url;
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedPost?.title || 'cover'}-art.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Image exported successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download image");
    }
  };

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

  if (isLoadingUser || isLoadingSub) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!currentUser) return <div className="p-8 text-center">Please log in to use the Cover Art Creator.</div>;

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <Sparkles className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-2xl font-bold font-heading mb-4">Cover Art Creator Locked</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Your free trial has ended. Upgrade to Pro to continue using the AI Cover Art Creator.
        </p>
        <Button onClick={() => setShowUpgradeModal(true)} size="lg" className="bg-gradient-to-r from-primary to-pink-500 text-white shadow-lg">
           Upgrade to Pro
        </Button>
        <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} triggerReason="coverart" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 flex flex-col min-h-[calc(100vh-6rem)] pb-32 md:pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-black flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" />
          AI Cover Art Creator
        </h1>
        <p className="text-muted-foreground mt-2">
          Let AI listen to your finished work and design a one-of-a-kind album cover with exclusive rights.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 flex-1">
        {/* Left: Track Selection */}
        <div className="w-full md:w-1/3 flex flex-col gap-4 border border-border bg-card rounded-xl p-4 overflow-y-auto custom-scrollbar max-h-[300px] md:max-h-none">
          <h2 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground">Your Tracks</h2>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : posts.length === 0 ? (
            <div className="text-center p-8 flex flex-col items-center justify-center text-muted-foreground text-sm">
              <Music className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="mb-4">No tracks found. You need a track to generate cover art.</p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/studio">Go to Studio</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm" disabled={isImporting}>
                      {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      Import Track
                      <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => importFileInputRef.current?.click()}>
                      <Smartphone className="w-4 h-4 mr-2" /> From Device
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const file = new File(["dummy audio content for testing"], "test-audio.mp3", { type: "audio/mpeg" });
                      handleImportAudio({ target: { files: [file] } });
                    }}>
                      <Smartphone className="w-4 h-4 mr-2" /> Mock Upload (Test)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowFilesDialog(true)}>
                      <Folder className="w-4 h-4 mr-2" /> From Files
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowPlaylistDialog(true)}>
                      <ListMusic className="w-4 h-4 mr-2" /> From Playlist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <input 
                  type="file" 
                  ref={importFileInputRef} 
                  className="hidden" 
                  accept="audio/*,video/*" 
                  onChange={handleImportAudio}
                />
              </div>
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

        {/* Modals */}
        <Dialog open={showFilesDialog} onOpenChange={setShowFilesDialog}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>Import from Files</DialogTitle>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {isLoadingFiles ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : sharedFiles.filter(f => f.file_type === "audio" || f.file_type === "video").length === 0 ? (
                <p className="text-center text-muted-foreground p-4">No audio or video files found in your Files.</p>
              ) : (
                sharedFiles
                  .filter(f => f.file_type === "audio" || f.file_type === "video")
                  .map(file => (
                    <button
                      key={file.id}
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 transition-colors flex items-center gap-3"
                      onClick={() => handleImportSharedFile(file)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <Music className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showPlaylistDialog} onOpenChange={(open) => {
          setShowPlaylistDialog(open);
          if (!open) setSelectedPlaylist(null);
        }}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>{selectedPlaylist ? "Select Track" : "Select Playlist"}</DialogTitle>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {!selectedPlaylist ? (
                isLoadingPlaylists ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : myPlaylists.length === 0 ? (
                  <p className="text-center text-muted-foreground p-4">No playlists found.</p>
                ) : (
                  myPlaylists.map(playlist => (
                    <button
                      key={playlist.id}
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 transition-colors flex items-center gap-3"
                      onClick={() => setSelectedPlaylist(playlist)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                        <ListMusic className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground">{playlist.track_ids?.length || 0} tracks</p>
                      </div>
                    </button>
                  ))
                )
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPlaylist(null)} className="mb-2">
                    &larr; Back to Playlists
                  </Button>
                  {isLoadingPlaylistTracks ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : playlistTracks.length === 0 ? (
                    <p className="text-center text-muted-foreground p-4">No tracks owned by you in this playlist.</p>
                  ) : (
                    playlistTracks.map(track => (
                      <button
                        key={track.id}
                        className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                        onClick={() => {
                          setSelectedPost(track);
                          setGeneratedImage(null);
                          setShowPlaylistDialog(false);
                          setSelectedPlaylist(null);
                          toast.success("Track selected!");
                        }}
                      >
                        <p className="font-medium text-sm truncate">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.genre || 'No genre'}</p>
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>Manual Cover Editing</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="aspect-square bg-black/50 rounded-lg overflow-hidden relative">
                {(generatedImage || selectedPost?.image_url) && (
                  <img 
                    src={generatedImage || selectedPost?.image_url} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    style={{ filter: `brightness(${editOptions.brightness}%) contrast(${editOptions.contrast}%) saturate(${editOptions.saturation}%)` }}
                  />
                )}
                {overlayImageRef && (
                  <img
                    src={overlayImageRef}
                    alt="Overlay"
                    className="absolute"
                    style={{
                      width: `${editOptions.overlayScale}%`,
                      left: `${editOptions.overlayX}%`,
                      top: `${editOptions.overlayY}%`,
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none'
                    }}
                  />
                )}
                {editOptions.text && (
                  <div 
                    className="absolute left-0 right-0 text-center font-bold"
                    style={{ 
                      color: editOptions.textColor, 
                      fontSize: '32px',
                      fontFamily: editOptions.fontFamily,
                      top: editOptions.textPosition === 'top' ? '15%' : editOptions.textPosition === 'bottom' ? '85%' : '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none'
                    }}
                  >
                    {editOptions.text}
                  </div>
                )}
              </div>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Brightness ({editOptions.brightness}%)</label>
                  <input type="range" min="0" max="200" value={editOptions.brightness} onChange={e => setEditOptions({...editOptions, brightness: e.target.value})} className="w-full accent-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Contrast ({editOptions.contrast}%)</label>
                  <input type="range" min="0" max="200" value={editOptions.contrast} onChange={e => setEditOptions({...editOptions, contrast: e.target.value})} className="w-full accent-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Saturation ({editOptions.saturation}%)</label>
                  <input type="range" min="0" max="200" value={editOptions.saturation} onChange={e => setEditOptions({...editOptions, saturation: e.target.value})} className="w-full accent-primary" />
                </div>
                
                <div className="pt-2 border-t border-border">
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Overlay Text</label>
                  <Input 
                    placeholder="Enter text..." 
                    value={editOptions.text} 
                    onChange={e => setEditOptions({...editOptions, text: e.target.value})} 
                  />
                </div>
                
                {editOptions.text && (
                  <>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-medium mb-1 block text-muted-foreground">Text Color</label>
                        <input 
                          type="color" 
                          value={editOptions.textColor} 
                          onChange={e => setEditOptions({...editOptions, textColor: e.target.value})}
                          className="w-full h-8 rounded cursor-pointer bg-transparent border-0 p-0" 
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-medium mb-1 block text-muted-foreground">Position</label>
                        <Select value={editOptions.textPosition} onValueChange={(val) => setEditOptions({...editOptions, textPosition: val})}>
                          <SelectTrigger className="w-full h-8 rounded border border-input bg-card px-2 text-sm text-foreground">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top">Top</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                            <SelectItem value="bottom">Bottom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block text-muted-foreground">Font Family</label>
                      <Select value={editOptions.fontFamily} onValueChange={(val) => setEditOptions({...editOptions, fontFamily: val})}>
                        <SelectTrigger className="w-full h-8 rounded border border-input bg-card px-2 text-sm text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sans-serif">Sans Serif</SelectItem>
                          <SelectItem value="serif">Serif</SelectItem>
                          <SelectItem value="monospace">Monospace</SelectItem>
                          <SelectItem value="cursive">Cursive</SelectItem>
                          <SelectItem value="fantasy">Fantasy</SelectItem>
                          <SelectItem value="Inter">Inter</SelectItem>
                          <SelectItem value="Space Grotesk">Space Grotesk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="pt-2 border-t border-border">
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Add Overlay Image (Logo/Sticker)</label>
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setOverlayImageRef(URL.createObjectURL(e.target.files[0]));
                      }
                    }} 
                  />
                </div>
                
                {overlayImageRef && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">Scale ({editOptions.overlayScale}%)</label>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => setOverlayImageRef(null)}>Remove Image</Button>
                    </div>
                    <input type="range" min="5" max="200" value={editOptions.overlayScale} onChange={e => setEditOptions({...editOptions, overlayScale: e.target.value})} className="w-full accent-primary" />
                    
                    <label className="text-xs font-medium block text-muted-foreground">Position X ({editOptions.overlayX}%)</label>
                    <input type="range" min="0" max="100" value={editOptions.overlayX} onChange={e => setEditOptions({...editOptions, overlayX: e.target.value})} className="w-full accent-primary" />
                    
                    <label className="text-xs font-medium block text-muted-foreground">Position Y ({editOptions.overlayY}%)</label>
                    <input type="range" min="0" max="100" value={editOptions.overlayY} onChange={e => setEditOptions({...editOptions, overlayY: e.target.value})} className="w-full accent-primary" />
                  </div>
                )}
              </div>
              
              <Button 
                className="w-full" 
                onClick={applyEdits}
                disabled={isApplyingEdits}
              >
                {isApplyingEdits ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PenTool className="w-4 h-4 mr-2" />}
                Apply Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Right: Generation Area */}
        <div className="w-full md:w-2/3 flex flex-col items-center border border-border bg-card/50 rounded-xl p-4 pb-32 sm:p-8 sm:pb-32 md:pb-12 relative overflow-y-auto custom-scrollbar min-h-[500px]">
          <div className="flex flex-col items-center w-full max-w-md my-auto">
            <div className="w-full aspect-square bg-black/50 rounded-2xl border-2 border-border overflow-hidden relative shadow-2xl flex items-center justify-center mb-6">
              {generatedImage ? (
                <img src={generatedImage} alt="Generated cover" className="w-full h-full object-cover" />
              ) : selectedPost?.image_url && !generateArtMutation.isPending ? (
                <img src={selectedPost.image_url} alt="Current cover" className="w-full h-full object-cover opacity-50 blur-sm" />
              ) : (
                <div className="text-center flex flex-col items-center justify-center text-muted-foreground/30">
                  <ImageIcon className="w-16 h-16 mb-2" />
                  {!selectedPost && <p className="text-sm font-medium mt-2 text-muted-foreground/70">Select a track first</p>}
                </div>
              )}

              {generateArtMutation.isPending && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                  <p className="font-heading font-semibold text-lg text-primary animate-pulse">{generatingStatus}</p>
                </div>
              )}
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload}
            />
            
            {!generatedImage ? (
              <div className="flex flex-wrap gap-3 w-full">
                <Button 
                  size="lg" 
                  className="flex-[2] min-w-[140px] h-14 text-lg gap-2 bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 shadow-lg shadow-primary/25 text-white"
                  onClick={() => {
                    if (!selectedPost) {
                      toast.error("Please select a track first to generate cover art.");
                      return;
                    }
                    generateArtMutation.mutate(selectedPost);
                  }}
                  disabled={generateArtMutation.isPending || isUploading}
                >
                  <Wand2 className="w-5 h-5" />
                  {selectedPost?.image_url ? 'Generate New' : 'Generate Cover'}
                </Button>
                
                <Button 
                  variant="outline"
                  size="lg" 
                  className="flex-1 min-w-[100px] h-14 gap-2 border-primary/50 text-primary hover:bg-primary/10 bg-transparent"
                  onClick={() => {
                    if (!selectedPost) {
                      toast.error("Please select a track first to upload an image.");
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  disabled={generateArtMutation.isPending || isUploading}
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  Upload
                </Button>
                <Button 
                  variant="outline"
                  size="lg" 
                  className="flex-1 min-w-[100px] h-14 gap-2 border-primary/50 text-primary hover:bg-primary/10 bg-transparent"
                  onClick={() => {
                    if (!selectedPost) {
                      toast.error("Please select a track first to upload an image.");
                      return;
                    }
                    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                    fetch(dataUrl).then(r => r.blob()).then(blob => {
                      const file = new File([blob], "mock-cover.png", { type: "image/png" });
                      handleFileUpload({ target: { files: [file] } });
                    });
                  }}
                  disabled={generateArtMutation.isPending || isUploading}
                >
                  Mock Upload (Test)
                </Button>

                {selectedPost?.image_url && (
                  <>
                  <Button 
                    variant="outline"
                    size="lg" 
                    className="flex-1 min-w-[100px] h-14 gap-2 bg-transparent"
                    onClick={() => setShowEditDialog(true)}
                    disabled={generateArtMutation.isPending || isUploading}
                  >
                    <PenTool className="w-5 h-5" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline"
                    size="lg" 
                    className="flex-1 min-w-[100px] h-14 gap-2 bg-transparent"
                    onClick={handleDownload}
                    disabled={generateArtMutation.isPending || isUploading}
                  >
                    <Download className="w-5 h-5" />
                    Export
                  </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 w-full">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="flex-1 min-w-[100px] h-12 gap-2 bg-transparent"
                  onClick={() => generateArtMutation.mutate(selectedPost)}
                  disabled={generateArtMutation.isPending || saveArtMutation.isPending || isUploading}
                >
                  <Wand2 className="w-4 h-4" />
                  Retry
                </Button>
                <Button 
                  variant="outline"
                  size="lg" 
                  className="flex-1 min-w-[100px] h-12 gap-2 bg-transparent"
                  onClick={() => setShowEditDialog(true)}
                  disabled={generateArtMutation.isPending || saveArtMutation.isPending || isUploading}
                >
                  <PenTool className="w-4 h-4" />
                  Edit
                </Button>
                <Button 
                  variant="outline"
                  size="lg" 
                  className="flex-1 min-w-[100px] h-12 gap-2 bg-transparent"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={generateArtMutation.isPending || saveArtMutation.isPending || isUploading}
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload
                </Button>
                <Button 
                  variant="outline"
                  size="lg" 
                  className="flex-1 min-w-[100px] h-12 gap-2 bg-transparent"
                  onClick={handleDownload}
                  disabled={generateArtMutation.isPending || saveArtMutation.isPending || isUploading}
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button 
                  size="lg" 
                  className="flex-[2] min-w-[140px] h-12 gap-2 bg-primary hover:bg-primary/90 text-white"
                  onClick={() => saveArtMutation.mutate()}
                  disabled={saveArtMutation.isPending || isUploading}
                >
                  {saveArtMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save to Track
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}