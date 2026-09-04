import { useRef, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sounds } from "@/hooks/use-sound";

/**
 * Full-screen call overlay with real WebRTC media rendering.
 * Handles incoming, ringing, connecting, and connected states for audio/video.
 */
export default function CallOverlay({
  callState,
  localStream,
  remoteStream,
  displayName,
  avatarSrc,
  avatarGradient,
  muted,
  videoEnabled,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleVideo,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [duration, setDuration] = useState(0);

  // Attach local stream to the PiP video element.
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to the full-screen video element.
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Call duration timer — runs only while connected.
  useEffect(() => {
    if (callState?.status !== "connected") {
      setDuration(0);
      return;
    }
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState?.status]);

  // Audio feedback: ring tone while ringing/incoming, connect chime, end tone.
  useEffect(() => {
    if (!callState) return;
    if (callState.status === "ringing" || callState.status === "incoming") {
      sounds.callRing();
      const interval = setInterval(() => sounds.callRing(), 2000);
      return () => clearInterval(interval);
    }
    if (callState.status === "connected") {
      sounds.callConnect();
    }
    if (callState.status === "ended") {
      sounds.callEnd();
    }
  }, [callState?.status]);

  if (!callState) return null;

  const isVideo = callState.type === "video";
  const isConnected = callState.status === "connected";
  const isIncoming = callState.status === "incoming";
  const isRinging = callState.status === "ringing";
  const isConnecting = callState.status === "connecting";
  const showRemoteVideo = isVideo && isConnected && !!remoteStream;

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-200">
      {/* Remote video — full screen for connected video calls */}
      {showRemoteVideo && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Center avatar + info for non-video-connected states */}
      {!showRemoteVideo && (
        <>
          <Avatar className="w-32 h-32 mb-6 shadow-2xl ring-4 ring-primary/20">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback className={cn("text-4xl text-white font-bold bg-gradient-to-br", avatarGradient)}>
              {displayName?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>

          <h2 className="text-3xl font-heading font-bold mb-2">{displayName}</h2>

          <p className="text-muted-foreground mb-2 flex items-center gap-2 min-h-[24px]">
            {isIncoming ? (
              `Incoming ${isVideo ? "video" : "audio"} call...`
            ) : isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : isRinging ? (
              <>
                <span className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
                </span>
                {isVideo ? "Video calling..." : "Calling..."}
              </>
            ) : isConnected ? (
              formatDuration(duration)
            ) : null}
          </p>
        </>
      )}

      {/* Duration badge for connected video calls */}
      {showRemoteVideo && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-background/60 backdrop-blur-md text-sm font-medium">
          {formatDuration(duration)}
        </div>
      )}

      {/* Local video PiP — shown whenever we have a local stream in a video call */}
      {isVideo && localStream && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute rounded-2xl shadow-2xl border-2 border-white/10 object-cover z-10",
            isConnected ? "top-6 right-6 w-32 h-44 sm:w-40 sm:h-52" : "top-6 right-6 w-24 h-32"
          )}
        />
      )}

      {/* Controls */}
      <div className={cn("flex items-center gap-6", (isIncoming || (!isConnected && !isIncoming)) && "mt-10")}>
        {isIncoming ? (
          <>
            <Button
              size="icon"
              className="w-16 h-16 rounded-full bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20 hover:scale-105 transition-transform"
              onClick={onDecline}
              title="Decline"
              aria-label="Decline Call"
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
            <Button
              size="icon"
              className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 hover:scale-105 transition-transform"
              onClick={onAccept}
              title="Accept"
              aria-label="Accept Call"
            >
              {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </Button>
          </>
        ) : (
          <>
            {isVideo && (
              <Button
                size="icon"
                variant="outline"
                className={cn(
                  "w-14 h-14 rounded-full border-white/10",
                videoEnabled ? "bg-secondary/50" : "bg-destructive/20"
              )}
                onClick={onToggleVideo}
                title={videoEnabled ? "Disable Video" : "Enable Video"}
                aria-label="Toggle Video"
              >
                {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </Button>
            )}
            <Button
              size="icon"
              variant="outline"
              className={cn(
                "w-14 h-14 rounded-full border-white/10",
                !muted ? "bg-secondary/50" : "bg-destructive/20"
              )}
              onClick={onToggleMute}
              title={muted ? "Unmute" : "Mute"}
              aria-label="Toggle Mute"
            >
              {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
            <Button
              size="icon"
              className="w-16 h-16 rounded-full bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20 hover:scale-105 transition-transform"
              onClick={onEnd}
              title="End Call"
              aria-label="End Call"
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}