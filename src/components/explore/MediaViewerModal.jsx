import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Play, Pause, X, Music, Rewind, FastForward, Square, ShoppingCart, Minimize2, Download, Share2, Flag, Lock } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { toast } from "sonner";
import { useAudioPlayer } from "@/lib/AudioPlayerContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NaliPresenceIndicator from "@/components/nali/NaliPresenceIndicator";
import ReportContentDialog from "@/components/ReportContentDialog";
import { copyToClipboard } from "@/lib/clipboard";
import { base44 } from "@/api/base44Client";

export default function MediaViewerModal({ post, open, onOpenChange, onAddToPlaylist, currentUser }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const { addToCart, items } = useCart();
  const inCart = items.some(item => item.id === post?.id);
  const audioPlayer = useAudioPlayer();
  const playTrack = audioPlayer?.playTrack;
  const [reportOpen, setReportOpen] = useState(false);

  // A priced track's Download button used to render unconditionally for every
  // visitor — free or paying — so buying a "license" delivered nothing you
  // couldn't already get for free. Gate the actual download behind ownership
  // (creator) or a confirmed Base44Purchase for this exact post; the inline
  // preview player above is left untouched (streaming a preview before buying
  // is normal marketplace behavior, unlike an unrestricted full download).
  const isPriced = Number(post?.price) > 0;
  const isOwner = !!currentUser && post?.creator_id === currentUser.id;
  const [purchasedIds, setPurchasedIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    if (!open || !isPriced || !currentUser?.id) {
      setPurchasedIds(new Set());
      return;
    }
    base44.entities.Base44Purchase.filter({ user_id: currentUser.id, status: "paid" })
      .then((purchases) => {
        if (cancelled) return;
        const ids = new Set();
        (purchases || []).forEach((p) => (p.items || []).forEach((item) => { if (item.id) ids.add(item.id); }));
        setPurchasedIds(ids);
      })
      .catch(() => { if (!cancelled) setPurchasedIds(new Set()); });
    return () => { cancelled = true; };
  }, [open, isPriced, currentUser?.id]);

  const canDownload = !isPriced || isOwner || purchasedIds.has(post?.id);

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [open]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (audioPlayer?.isPlaying) {
          if (typeof audioPlayer.togglePlay === 'function') {
            audioPlayer.togglePlay();
          }
        }
        audioRef.current.play().catch(e => {
          console.error("Playback failed:", e);
        });
      }
    }
  };

  const handleTimeChange = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const skipBackward = () => {
    if (audioRef.current) {
      const newTime = Math.max(0, audioRef.current.currentTime - 10);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      const newTime = Math.min(duration || 0, audioRef.current.currentTime + 10);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0c] border-white/10 max-w-5xl p-0 shadow-2xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">{post.title || "Media viewer"}</DialogTitle>
        <DialogDescription className="sr-only">{post.description || "View media details and playback."}</DialogDescription>
        
        <div className="flex flex-col md:flex-row h-full md:h-[600px] relative w-full">
          {/* Ambient Background */}
          {post.image_url && (
            <div 
              className="absolute inset-0 opacity-20 blur-3xl scale-150 pointer-events-none transition-all duration-1000"
              style={{ backgroundImage: `url(${post.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          )}

          {/* Media Side */}
          <div className="w-full md:w-1/2 h-[350px] md:h-full relative flex-shrink-0 group bg-black/50">
            {post.image_url && !post.image_url.includes(".mp3") && !post.image_url.includes(".wav") && !post.image_url.includes(".ogg") ? (
              <img
                src={post.image_url}
                alt={post.title}
                className="w-full h-full object-cover"
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/20">
                <Music className="w-24 h-24 text-white/10 mb-4" />
              </div>
            )}
            
            {/* Gradient Fades for blending */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] to-transparent md:hidden" />
            <div className="absolute inset-0 bg-gradient-to-l from-[#0a0a0c] to-transparent hidden md:block" />
          </div>

          {/* Content Side */}
          <div className="flex-1 flex flex-col p-6 md:p-10 relative z-10 justify-end h-full">
             <div className="flex-1 flex flex-col justify-center">
                 <div className="flex flex-wrap gap-2 mb-4">
                   {post.genre && <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-full">{post.genre}</span>}
                   {post.medium && <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 bg-white/5 px-2.5 py-1 rounded-full">{post.medium}</span>}
                 </div>
                 
                 <h2 className="text-3xl md:text-5xl font-heading font-black text-white mb-2 leading-tight drop-shadow-lg line-clamp-2">{post.title}</h2>
                 
                 <Link 
                   to={`/profile?id=${post.creator_id}`}
                   onClick={() => onOpenChange(false)}
                   className="flex items-center gap-3 mt-4 mb-6 hover:opacity-80 transition-opacity"
                 >
                   <Avatar className="w-10 h-10 ring-2 ring-white/10">
                     <AvatarImage src={post.creator_avatar} />
                     <AvatarFallback className="bg-primary/20 text-primary">{post.creator_name?.[0]?.toUpperCase()}</AvatarFallback>
                   </Avatar>
                   <div>
                     <p className="text-sm font-semibold text-white/90 hover:underline">{post.creator_name || "Anonymous"}</p>
                     <p className="text-xs text-white/50">Creator</p>
                   </div>
                 </Link>

                 {post.description && (
                   <p className="text-sm text-white/70 line-clamp-3 mb-6 leading-relaxed">{post.description}</p>
                 )}

                 {/* Nali presence — proactive but muted; respects user's presence level setting */}
                 <div className="flex items-center gap-2 mb-6">
                   <NaliPresenceIndicator
                     surface="track"
                     size="sm"
                     greeting={`Nali, the user is viewing "${post.title}" by ${post.creator_name || 'this artist'}. Offer a brief, expert insight about the track's genre, production, or arrangement.`}
                   />
                   <span className="text-[11px] text-white/40">Ask Nali about this track</span>
                 </div>

                 <div className="flex flex-wrap items-center gap-4 mb-8">
                   {Number(post.price) > 0 && (
                     <Button 
                       size="lg"
                       type="button"
                       onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         addToCart({
                           ...post,
                           type: 'stem_license',
                         });
                       }}
                       disabled={inCart}
                       className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 gap-2 h-14 px-6 sm:px-8 text-base rounded-full flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
                     >
                       <ShoppingCart className="w-5 h-5" />
                       {inCart ? "In Cart" : `Buy for $${Number(post.price).toFixed(2)}`}
                     </Button>
                   )}
                   {(!post.price || Number(post.price) === 0) && (
                     <Button 
                       size="lg"
                       className="bg-white/10 text-white border border-white/10 shadow-lg gap-2 h-14 px-6 sm:px-8 text-base rounded-full flex-shrink-0 cursor-default"
                     >
                       Free
                     </Button>
                   )}
                   {onAddToPlaylist && (
                     <Button 
                       size="lg"
                       onClick={() => onAddToPlaylist(post.id)}
                       className="bg-white/10 text-white hover:bg-white/20 border border-white/10 shadow-lg gap-2 h-14 px-6 text-base rounded-full flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
                     >
                       <Music className="w-5 h-5" />
                       Add to Playlist
                     </Button>
                   )}
                   
                   {post.file_url && canDownload && (
                     <Button
                       size="lg"
                       type="button"
                       onClick={async (e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         toast.success("Download started...");
                         try {
                           const { resumableDownload } = await import('@/lib/resumableUpload');
                           let fileName = post.title || 'download';
                           // Append extension from URL if not already present
                           if (post.file_url && !fileName.match(/\.[a-zA-Z0-9]+$/)) {
                             const match = post.file_url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
                             if (match) fileName += '.' + match[1];
                           }
                           await resumableDownload(post.file_url, fileName, () => {});
                           toast.success("Download complete");
                         } catch (err) {
                           toast.error("Download failed");
                         }
                       }}
                       className="bg-white/10 text-white hover:bg-white/20 border border-white/10 shadow-lg gap-2 h-14 px-6 text-base rounded-full flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
                     >
                       <Download className="w-5 h-5" />
                       Download
                     </Button>
                   )}

                   {post.file_url && !canDownload && (
                     <div
                       title="Purchase this track to unlock the full download"
                       className="flex items-center gap-2 h-14 px-6 rounded-full border border-white/10 text-white/50 text-sm flex-shrink-0"
                     >
                       <Lock className="w-4 h-4" />
                       Buy to unlock download
                     </div>
                   )}
                   
                   <Button
                     type="button"
                     size="lg"
                     onClick={(e) => {
                       e.preventDefault();
                       e.stopPropagation();
                       const textToShare = `Check out this track: ${post.title} on NaliChat!`;
                       if (navigator.share) {
                         navigator.share({
                           title: post.title,
                           text: textToShare,
                           url: window.location.href,
                         }).catch(console.error);
                       } else {
                         copyToClipboard(`${textToShare} ${window.location.href}`);
                         toast.success("Link copied to clipboard to share in messages!");
                       }
                     }}
                     className="bg-white/10 text-white hover:bg-white/20 border border-white/10 shadow-lg gap-2 h-14 px-6 text-base rounded-full flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
                   >
                     <Share2 className="w-5 h-5" />
                     Share
                   </Button>

                   <Button
                     type="button"
                     size="lg"
                     onClick={(e) => {
                       e.preventDefault();
                       e.stopPropagation();
                       setReportOpen(true);
                     }}
                     className="bg-white/5 text-white/50 hover:bg-destructive/15 hover:text-destructive border border-white/10 shadow-lg gap-2 h-14 px-6 text-base rounded-full flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
                   >
                     <Flag className="w-5 h-5" />
                     Report
                   </Button>
                 </div>

                 <div className="grid grid-cols-2 gap-4 mb-8">
                    {(post.bpm || post.duration) && (
                       <>
                         {post.bpm && (
                           <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-md">
                             <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Tempo</p>
                             <p className="font-mono text-lg text-white/90">{post.bpm} <span className="text-xs text-white/40">BPM</span></p>
                           </div>
                         )}
                         {post.duration && (
                           <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-md">
                             <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Length</p>
                             <p className="font-mono text-lg text-white/90">{formatTime(post.duration)}</p>
                           </div>
                         )}
                       </>
                    )}
                 </div>
                 
                 {Array.isArray(post.tags) && post.tags.length > 0 && (
                   <div className="flex flex-wrap gap-2 mb-8">
                     {post.tags.map(tag => (
                       <span key={tag} className="text-xs text-white/50 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                         #{tag}
                       </span>
                     ))}
                   </div>
                 )}
             </div>

             {/* Audio Player */}
             {(post.file_url || post.image_url?.includes(".mp3") || post.image_url?.includes(".wav") || post.image_url?.includes(".ogg")) && (
               <div className="mt-auto pt-6 border-t border-white/10">
                 <audio
                   ref={audioRef}
                   src={post.file_url || post.image_url}
                   onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                   onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                   onEnded={() => setIsPlaying(false)}
                   onPlay={() => setIsPlaying(true)}
                   onPause={() => setIsPlaying(false)}
                   controlsList="nodownload nofullscreen noremoteplayback"
                 />

                 <div className="flex flex-col gap-4">
                   {/* Progress Bar */}
                   <div className="flex items-center gap-3">
                     <span className="text-xs font-mono text-white/50 w-10 text-right">{formatTime(currentTime)}</span>
                     <div className="flex-1 relative group cursor-pointer h-4 flex items-center">
                       <input
                         type="range"
                         min="0"
                         max={duration || 0}
                         value={currentTime}
                         onChange={handleTimeChange}
                         title="Seek audio"
                         aria-label="Seek audio"
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                       />
                       <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-gradient-to-r from-primary to-pink-500 rounded-full"
                           style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                         />
                       </div>
                       {/* Thumb */}
                       <div 
                         className="absolute h-3 w-3 bg-white rounded-full shadow-lg shadow-black/50 scale-0 group-hover:scale-100 transition-transform pointer-events-none"
                         style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)` }}
                       />
                     </div>
                     <span className="text-xs font-mono text-white/50 w-10">{formatTime(duration)}</span>
                   </div>

                   {/* Controls */}
                   <div className="flex items-center justify-center gap-4 sm:gap-6">
                     <Button
                       type="button"
                       variant="ghost"
                       size="icon"
                       className="rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors h-10 w-10 sm:h-12 sm:w-12"
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); stopPlayback(); }}
                       title="Stop"
                     >
                       <Square className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                     </Button>

                     <Button
                       type="button"
                       variant="ghost"
                       size="icon"
                       className="rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors h-10 w-10 sm:h-12 sm:w-12"
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); skipBackward(); }}
                       title="Rewind 10s"
                     >
                       <Rewind className="w-5 h-5 sm:w-6 sm:h-6" />
                     </Button>
                     
                     <Button
                       type="button"
                       className="rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-white hover:bg-white/90 text-black shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:scale-105 transition-all shrink-0"
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePlay(); }}
                       title={isPlaying ? "Pause" : "Play"}
                     >
                       {isPlaying ? (
                         <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
                       ) : (
                         <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-1" />
                       )}
                     </Button>

                     <Button
                       type="button"
                       variant="ghost"
                       size="icon"
                       className="rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors h-10 w-10 sm:h-12 sm:w-12"
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); skipForward(); }}
                       title="Fast Forward 10s"
                     >
                       <FastForward className="w-5 h-5 sm:w-6 sm:h-6" />
                     </Button>

                     <Button
                       type="button"
                       variant="ghost"
                       size="icon"
                       className="rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors h-10 w-10 sm:h-12 sm:w-12"
                       onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         stopPlayback();
                         onOpenChange(false);
                         if (typeof playTrack === 'function') {
                           playTrack(post);
                         }
                       }}
                       title="Open in Global Player"
                     >
                       <Minimize2 className="w-5 h-5 sm:w-6 sm:h-6" />
                     </Button>
                   </div>
                 </div>
               </div>
             )}
          </div>

          {/* Close Button */}
          <button
            onClick={() => onOpenChange(false)}
            title="Close"
            aria-label="Close"
            className="fixed top-4 right-4 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white backdrop-blur-md transition-all z-50 border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
          </div>
          </DialogContent>
          <ReportContentDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          contentType="art_post"
          contentId={post.id}
          contentText={post.title || ""}
          />
          </Dialog>
  );
}