import { secureUploadFile } from "@/lib/secureUpload";
import { validateUpload } from "@/lib/uploadValidation";
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
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/AuthContext";
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


async function filterAllRows(entity, query, sort = "-created_date") {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.filter(query, sort, pageSize, skip);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function CoverArt() {
  const { hasEntitlement } = useSubscription();
  const canUseAi = hasEntitlement("ai.standard");
  const { user: currentUser, isLoadingAuth } = useAuth();
  const [selectedPost, setSelectedPost] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatingStatus, setGeneratingStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const activeUserIdRef = useRef(currentUser?.id || null);
  const queryClient = useQueryClient();

  useEffect(() => {
    activeUserIdRef.current = currentUser?.id || null;
  }, [currentUser?.id]);


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

  useEffect(() => () => {
    if (overlayImageRef) URL.revokeObjectURL(overlayImageRef);
  }, [overlayImageRef]);
  const [isApplyingEdits, setIsApplyingEdits] = useState(false);

  useEffect(() => {
    // Generated/editing state can contain private media from the previous account.
    // Clear it before the next identity can interact with this surface.
    setSelectedPost(null);
    setGeneratedImage(null);
    setGeneratingStatus("");
    setShowFilesDialog(false);
    setShowPlaylistDialog(false);
    setSelectedPlaylist(null);
    setShowEditDialog(false);
    setOverlayImageRef(null);
    setEditOptions({
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
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  }, [currentUser?.id]);

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
      
      const { file_url } = await secureUploadFile({ file });
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

  const { data: sharedFiles = [], isLoading: isLoadingFiles, isError: filesError, refetch: refetchFiles } = useQuery({
    queryKey: ["mySharedFiles", currentUser?.id],
    queryFn: () => currentUser ? filterAllRows(base44.entities.SharedFile, { uploader_id: currentUser.id }) : [],
    enabled: showFilesDialog && !!currentUser,
  });

  const { data: myPlaylists = [], isLoading: isLoadingPlaylists, isError: playlistsError, refetch: refetchPlaylists } = useQuery({
    queryKey: ["myPlaylists", currentUser?.id],
    queryFn: () => currentUser ? filterAllRows(base44.entities.Playlist, { owner_id: currentUser.id }) : [],
    enabled: showPlaylistDialog && !!currentUser,
  });

  const {
    data: playlistTrackResult = { tracks: [], unavailableCount: 0 },
    isLoading: isLoadingPlaylistTracks,
  } = useQuery({
    queryKey: ["playlistTracks", currentUser?.id, selectedPlaylist?.id],
    queryFn: async () => {
      if (!selectedPlaylist?.track_ids?.length) return { tracks: [], unavailableCount: 0 };
      const settled = await Promise.allSettled(
        selectedPlaylist.track_ids.map((id) => base44.entities.ArtPost.get(id))
      );
      const tracks = settled
        .filter((result) => result.status === "fulfilled" && result.value)
        .map((result) => result.value)
        .filter((track) => track.creator_id === currentUser.id);
      const unavailableCount = settled.filter((result) => result.status === "rejected").length;
      return { tracks, unavailableCount };
    },
    enabled: !!selectedPlaylist,
  });
  const playlistTracks = playlistTrackResult.tracks;

  const handleImportSharedFile = async (file) => {
    const importOwnerId = currentUser?.id;
    if (!importOwnerId || file?.uploader_id !== importOwnerId) return;
    try {
      setIsImporting(true);
      setShowFilesDialog(false);
      toast.info('Importing track from Files...');
      const published = await base44.functions.invoke("createArtPost", {
        title: file.name.replace(/\.[^/.]+$/, ""),
        description: "Imported from Files",
        medium: "original",
        is_explicit: false,
        file_url: file.file_url,
        genre: "Unknown",
        tags: ["imported"],
      });
      if (published?.data?.error) throw new Error(published.data.error);
      if (
        activeUserIdRef.current !== importOwnerId ||
        published?.data?.success !== true ||
        published?.data?.action !== "create_art_post" ||
        published?.data?.userId !== importOwnerId ||
        published?.data?.post?.creator_id !== importOwnerId ||
        !published?.data?.post?.id
      ) throw new Error("Track import was not confirmed");
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
    const importOwnerId = currentUser?.id;
    if (!file || !importOwnerId) return;
    const validation = validateUpload(file);
    if (!validation.ok) {
      toast.error(validation.error);
      event.target.value = "";
      return;
    }
    
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      toast.error('Please upload an audio file');
      return;
    }

    try {
      setIsImporting(true);
      toast.info('Uploading track...');
      const { file_url } = await secureUploadFile({ file });
      if (activeUserIdRef.current !== importOwnerId) return;
      const published = await base44.functions.invoke("createArtPost", {
        title: file.name.replace(/\.[^/.]+$/, ""),
        description: "Imported track",
        medium: "original",
        is_explicit: false,
        file_url,
        genre: "Unknown",
        tags: ["imported"],
      });
      if (published?.data?.error) throw new Error(published.data.error);
      if (
        activeUserIdRef.current !== importOwnerId ||
        published?.data?.success !== true ||
        published?.data?.action !== "create_art_post" ||
        published?.data?.userId !== importOwnerId ||
        published?.data?.post?.creator_id !== importOwnerId ||
        !published?.data?.post?.id
      ) throw new Error("Track import was not confirmed");
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


  const { data: posts = [], isLoading, isError: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ["myArtPosts", currentUser?.id],
    queryFn: () => currentUser ? filterAllRows(base44.entities.ArtPost, { creator_id: currentUser.id }) : [],
    enabled: !!currentUser,
  });

  const generateArtMutation = useMutation({
    mutationFn: async (post) => {
      setGeneratingStatus("Listening to your track...");
      const res = await base44.functions.invoke('generate-cover-art', {
        post_id: post.id,
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (!res.data?.image_url) throw new Error("Image generation failed");
      setGeneratingStatus("Painting final masterpiece...");
      return res.data.image_url;
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
      const saveOwnerId = currentUser?.id;
      const targetPostId = selectedPost?.id;
      if (!saveOwnerId || !targetPostId || selectedPost?.creator_id !== saveOwnerId || !generatedImage) return;
      const res = await base44.functions.invoke("mutateArtPost", {
        postId: targetPostId,
        image_url: generatedImage,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const post = res?.data?.post;
      if (
        activeUserIdRef.current !== saveOwnerId ||
        res?.data?.success !== true ||
        res?.data?.action !== "update_art_post" ||
        res?.data?.userId !== saveOwnerId ||
        res?.data?.postId !== targetPostId ||
        post?.id !== targetPostId ||
        post?.creator_id !== saveOwnerId
      ) throw new Error("Cover art save was not confirmed");
      return post;
    },
    onSuccess: () => {
      toast.success("Cover art saved to track!");
      queryClient.invalidateQueries({ queryKey: ["myArtPosts"] });
      queryClient.invalidateQueries({ queryKey: ["artposts"] });
      setGeneratedImage(null);
      setSelectedPost(null);
    },
    onError: (error) => {
      console.error("Failed to save cover art:", error);
      toast.error(error?.message || "Failed to save cover art. Please try again.");
    }
  });

  const handleDownload = async () => {
    const imageUrl = generatedImage || selectedPost?.image_url;
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Cover art download failed: ${response.status}`);
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
    const uploadOwnerId = currentUser?.id;
    const targetPostId = selectedPost?.id;
    if (!file || !uploadOwnerId || !targetPostId || selectedPost?.creator_id !== uploadOwnerId) return;
    const validation = validateUpload(file);
    if (!validation.ok) {
      toast.error(validation.error);
      event.target.value = "";
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    try {
      setIsUploading(true);
      const { file_url } = await secureUploadFile({ file });
      if (activeUserIdRef.current !== uploadOwnerId || selectedPost?.id !== targetPostId) return;
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

  if (isLoadingAuth) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!currentUser) return <div className="p-8 text-center">Please log in to use the Cover Art Creator.</div>;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl flex-col px-4 py-5 pb-[max(7rem,env(safe-area-inset-bottom))] sm:p-8 md:pb-12">
      <div className="mb-6 sm:mb-8">
        <h1 className="flex items-center gap-3 font-heading text-2xl font-black tracking-tight sm:text-3xl">
          <Sparkles className="h-8 w-8 shrink-0 text-primary" />
          AI Cover Art Creator
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Let AI listen to your finished work and design a one-of-a-kind album cover with exclusive rights.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 sm:gap-6 md:flex-row md:gap-8">
        {/* Left: Track Selection */}
        <div className="ui-surface custom-scrollbar flex max-h-[320px] w-full flex-col gap-3 overflow-y-auto overscroll-contain rounded-3xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-xl md:max-h-none md:w-1/3">
          <h2 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground">Your Tracks</h2>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : postsError ? (
            <div className="text-center p-8">
              <p className="text-sm font-semibold">Couldn't load your tracks</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refetchPosts()}>
                Retry
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-5 text-center text-sm text-muted-foreground sm:p-8">
              <Music className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="mb-4">No tracks found. You need a track to generate cover art.</p>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
                role="button"
                tabIndex={0}
                onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !generateArtMutation.isPending) { event.preventDefault(); setSelectedPost(post); setGeneratedImage(null); } }}
                className={`ui-hover min-h-14 cursor-pointer rounded-2xl border p-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-primary/40 ${selectedPost?.id === post.id ? 'border-primary bg-primary/10 ring-1 ring-primary/20' : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-card/70'}`}
              >
                <p className="font-semibold text-sm truncate">{post.title}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{post.genre || 'No genre'} • {post.medium}</p>
              </div>
            ))
          )}
        </div>

        {/* Modals */}
        <Dialog open={showFilesDialog} onOpenChange={setShowFilesDialog}>
          <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-3xl border-border/80 bg-card/95 p-5 backdrop-blur-xl sm:p-6">
            <DialogHeader>
              <DialogTitle>Import from Files</DialogTitle>
            </DialogHeader>
            <div className="custom-scrollbar max-h-[70dvh] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {isLoadingFiles ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filesError ? (
                <div className="p-6 text-center" role="alert">
                  <p className="text-sm font-semibold">Couldn't load your Files</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refetchFiles()}>
                    Retry
                  </Button>
                </div>
              ) : sharedFiles.filter(f => f.file_type === "audio" || f.file_type === "video").length === 0 ? (
                <p className="text-center text-muted-foreground p-4">No audio or video files found in your Files.</p>
              ) : (
                sharedFiles
                  .filter(f => f.file_type === "audio" || f.file_type === "video")
                  .map(file => (
                    <button
                      key={file.id}
                      className="ui-hover flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border p-3 text-left transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
                      onClick={() => handleImportSharedFile(file)}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/20">
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
          <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-3xl border-border/80 bg-card/95 p-5 backdrop-blur-xl sm:p-6">
            <DialogHeader>
              <DialogTitle>{selectedPlaylist ? "Select Track" : "Select Playlist"}</DialogTitle>
            </DialogHeader>
            <div className="custom-scrollbar max-h-[70dvh] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {!selectedPlaylist ? (
                isLoadingPlaylists ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : playlistsError ? (
                  <div className="p-6 text-center" role="alert">
                    <p className="text-sm font-semibold">Couldn't load your playlists</p>
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refetchPlaylists()}>
                      Retry
                    </Button>
                  </div>
                ) : myPlaylists.length === 0 ? (
                  <p className="text-center text-muted-foreground p-4">No playlists found.</p>
                ) : (
                  myPlaylists.map(playlist => (
                    <button
                      key={playlist.id}
                      className="ui-hover flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border p-3 text-left transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
                      onClick={() => setSelectedPlaylist(playlist)}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/20">
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
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPlaylist(null)} className="ui-hover mb-2 min-h-10 rounded-xl">
                    &larr; Back to Playlists
                  </Button>
                  {playlistTrackResult.unavailableCount > 0 && !isLoadingPlaylistTracks && (
                    <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300" role="status">
                      {playlistTrackResult.unavailableCount} playlist track{playlistTrackResult.unavailableCount === 1 ? "" : "s"} couldn't be loaded. Showing the tracks that are available.
                    </div>
                  )}
                  {isLoadingPlaylistTracks ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : playlistTracks.length === 0 ? (
                    <p className="text-center text-muted-foreground p-4">No tracks owned by you in this playlist.</p>
                  ) : (
                    playlistTracks.map(track => (
                      <button
                        key={track.id}
                        className="ui-hover min-h-14 w-full rounded-2xl border border-border p-3 text-left transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
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
          <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-3xl border-border/80 bg-card/95 p-5 backdrop-blur-xl sm:p-6">
            <DialogHeader>
              <DialogTitle>Manual Cover Editing</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-2xl border border-border bg-black/50">
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
              
              <div className="custom-scrollbar max-h-[42dvh] space-y-4 overflow-y-auto overscroll-contain pr-2 sm:max-h-[45vh]">
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Brightness ({editOptions.brightness}%)</label>
                  <input type="range" min="0" max="200" value={editOptions.brightness} onChange={e => setEditOptions({...editOptions, brightness: e.target.value})} className="h-6 w-full cursor-pointer accent-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Contrast ({editOptions.contrast}%)</label>
                  <input type="range" min="0" max="200" value={editOptions.contrast} onChange={e => setEditOptions({...editOptions, contrast: e.target.value})} className="h-6 w-full cursor-pointer accent-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Saturation ({editOptions.saturation}%)</label>
                  <input type="range" min="0" max="200" value={editOptions.saturation} onChange={e => setEditOptions({...editOptions, saturation: e.target.value})} className="h-6 w-full cursor-pointer accent-primary" />
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
                          className="h-11 w-full cursor-pointer rounded-xl border border-border bg-transparent p-1" 
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-medium mb-1 block text-muted-foreground">Position</label>
                        <Select value={editOptions.textPosition} onValueChange={(val) => setEditOptions({...editOptions, textPosition: val})}>
                          <SelectTrigger className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground">
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
                        <SelectTrigger className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground">
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
                      const selected = e.target.files?.[0];
                      if (!selected) return;
                      const validation = validateUpload(selected, { accept: "image" });
                      if (!validation.ok) {
                        toast.error(validation.error);
                        e.target.value = "";
                        return;
                      }
                      setOverlayImageRef(URL.createObjectURL(selected));
                    }} 
                  />
                </div>
                
                {overlayImageRef && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">Scale ({editOptions.overlayScale}%)</label>
                      <Button variant="ghost" size="sm" className="ui-hover min-h-9 rounded-lg px-2 text-xs text-destructive" onClick={() => setOverlayImageRef(null)}>Remove Image</Button>
                    </div>
                    <input type="range" min="5" max="200" value={editOptions.overlayScale} onChange={e => setEditOptions({...editOptions, overlayScale: e.target.value})} className="h-6 w-full cursor-pointer accent-primary" />
                    
                    <label className="text-xs font-medium block text-muted-foreground">Position X ({editOptions.overlayX}%)</label>
                    <input type="range" min="0" max="100" value={editOptions.overlayX} onChange={e => setEditOptions({...editOptions, overlayX: e.target.value})} className="h-6 w-full cursor-pointer accent-primary" />
                    
                    <label className="text-xs font-medium block text-muted-foreground">Position Y ({editOptions.overlayY}%)</label>
                    <input type="range" min="0" max="100" value={editOptions.overlayY} onChange={e => setEditOptions({...editOptions, overlayY: e.target.value})} className="h-6 w-full cursor-pointer accent-primary" />
                  </div>
                )}
              </div>
              
              <Button 
                className="ui-hover min-h-12 w-full rounded-xl font-semibold" 
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
        <div className="ui-surface custom-scrollbar relative flex min-h-[400px] w-full flex-col items-center overflow-y-auto rounded-3xl border border-white/[0.06] bg-card/50 p-4 pb-8 backdrop-blur-xl sm:min-h-[500px] sm:p-8 md:w-2/3 md:pb-12">
          <div className="flex flex-col items-center w-full max-w-md my-auto">
            <div className="relative mb-5 flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl border border-border bg-black/50 shadow-2xl sm:mb-6">
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

              {selectedPost?.is_explicit === true && (
                <div
                  data-testid="parental-advisory-badge"
                  className="absolute left-4 bottom-4 z-20 bg-black/90 text-white border border-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.3em] leading-tight shadow-xl"
                >
                  <div>Parental</div>
                  <div>Advisory</div>
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
              <div className="grid w-full grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-3">
                <Button 
                  size="lg" 
                  className="ui-hover min-[380px]:col-span-2 h-14 gap-2 rounded-xl bg-gradient-to-r from-primary to-pink-500 text-base font-semibold text-white shadow-lg shadow-primary/25 hover:opacity-90 sm:min-w-[140px] sm:flex-[2] sm:text-lg"
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
                  className="ui-hover h-14 gap-2 rounded-xl border-primary/50 bg-transparent text-primary hover:bg-primary/10 sm:min-w-[100px] sm:flex-1"
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
                {selectedPost?.image_url && (
                  <>
                  <Button 
                    variant="outline"
                    size="lg" 
                    className="ui-hover h-14 gap-2 rounded-xl bg-transparent sm:min-w-[100px] sm:flex-1"
                    onClick={() => setShowEditDialog(true)}
                    disabled={!canUseAi || generateArtMutation.isPending || isUploading}
                  >
                    <PenTool className="w-5 h-5" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline"
                    size="lg" 
                    className="ui-hover h-14 gap-2 rounded-xl bg-transparent sm:min-w-[100px] sm:flex-1"
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
              <div className="grid w-full grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-3">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="ui-hover h-12 gap-2 rounded-xl bg-transparent sm:min-w-[100px] sm:flex-1"
                  onClick={() => generateArtMutation.mutate(selectedPost)}
                  disabled={generateArtMutation.isPending || saveArtMutation.isPending || isUploading}
                >
                  <Wand2 className="w-4 h-4" />
                  Retry
                </Button>
                <Button 
                  variant="outline"
                  size="lg" 
                  className="ui-hover h-12 gap-2 rounded-xl bg-transparent sm:min-w-[100px] sm:flex-1"
                  onClick={() => setShowEditDialog(true)}
                  disabled={generateArtMutation.isPending || saveArtMutation.isPending || isUploading}
                >
                  <PenTool className="w-4 h-4" />
                  Edit
                </Button>
                <Button 
                  variant="outline"
                  size="lg" 
                  className="ui-hover h-12 gap-2 rounded-xl bg-transparent sm:min-w-[100px] sm:flex-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={generateArtMutation.isPending || saveArtMutation.isPending || isUploading}
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload
                </Button>
                <Button 
                  variant="outline"
                  size="lg" 
                  className="ui-hover h-12 gap-2 rounded-xl bg-transparent sm:min-w-[100px] sm:flex-1"
                  onClick={handleDownload}
                  disabled={generateArtMutation.isPending || saveArtMutation.isPending || isUploading}
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button 
                  size="lg" 
                  className="ui-hover min-[380px]:col-span-2 h-12 gap-2 rounded-xl bg-primary font-semibold text-white hover:bg-primary/90 sm:min-w-[140px] sm:flex-[2]"
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