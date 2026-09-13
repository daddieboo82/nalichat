import { secureUploadFile } from "@/lib/secureUpload";
import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import MultiTrackEditor from "../studio/MultiTrackEditor";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function recordingExtension(mimeType = "") {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

async function listSessionTracks(projectId) {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.Track.filter(
      { project_id: projectId },
      "created_date",
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function ChatSessionViewer({ message, currentUser }) {
  const [tracks, setTracks] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tracksError, setTracksError] = useState(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);
  const chunksRef = useRef([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try { recorder.stop(); } catch {}
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let refreshInFlight = false;

    const refreshTracks = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        const next = await listSessionTracks(message.id);
        if (!cancelled) {
          setTracks(next || []);
          setTracksError(false);
        }
      } catch {
        if (!cancelled) setTracksError(true);
      } finally {
        refreshInFlight = false;
      }
    };

    refreshTracks();
    const poll = window.setInterval(refreshTracks, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [message.id]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (typeof MediaRecorder === "undefined") {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        throw new Error("MediaRecorder is not supported");
      }
      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const recordingMimeType = recorder.mimeType || mimeType || "audio/webm";
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (streamRef.current === stream) streamRef.current = null;
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
        if (!mountedRef.current) {
          chunksRef.current = [];
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recordingMimeType });
        if (blob.size === 0) {
          toast.error("No audio was captured. Please check your microphone and try again.");
          return;
        }
        setUploading(true);
        const extension = recordingExtension(recordingMimeType);
        const file = new File([blob], `track-${Date.now()}.${extension}`, { type: recordingMimeType });
        try {
          const { file_url } = await secureUploadFile({ file });
          const created = await base44.functions.invoke("createCollaborativeTrack", {
            project_id: message.id,
            name: `Track by ${currentUser?.full_name || "Unknown"}`,
            file_url,
            type: "vocal",
          });
          if (created?.data?.error) throw new Error(created.data.error);
          const track = created?.data?.track;
          if (
            created?.data?.success !== true ||
            created?.data?.action !== "create_collaborative_track" ||
            created?.data?.userId !== currentUser?.id ||
            created?.data?.parentId !== message.id ||
            created?.data?.trackId !== track?.id ||
            !track?.id ||
            track?.project_id !== message.id ||
            track?.uploaded_by !== currentUser?.id
          ) throw new Error("Track was not created");
          if (mountedRef.current) {
            setTracks((current) => [
              ...current.filter((existing) => existing.id !== track.id),
              track,
            ]);
          }
        } catch (e) {
          console.error(e);
          if (mountedRef.current) {
            toast.error("Couldn't add the recorded track. Please try again.");
          }
        } finally {
          if (mountedRef.current) setUploading(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      if (mountedRef.current) setIsRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start recording. Check microphone access and try again.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="flex flex-col h-[400px] w-[280px] sm:w-[400px] md:w-[500px] bg-background border border-border/50 rounded-xl overflow-hidden mt-2 relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-secondary/30">
        <h3 className="font-semibold text-sm truncate max-w-[200px]">Live Session: {message.text || "Untitled"}</h3>
        <div className="flex items-center gap-2">
          {uploading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {isRecording ? (
            <Button size="sm" variant="destructive" onClick={stopRecording} className="h-8 rounded-full gap-2">
              <Square className="w-3.5 h-3.5 fill-current" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={startRecording} className="h-8 rounded-full gap-2 bg-red-500 hover:bg-red-600 text-white" disabled={uploading}>
              <Mic className="w-3.5 h-3.5" /> Record Track
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 relative">
        {tracksError && (
          <div className="absolute inset-x-3 top-3 z-10 rounded-xl border border-destructive/30 bg-background/95 px-3 py-2 text-xs text-destructive shadow-sm" role="alert">
            Couldn't load session tracks. The app will retry automatically.
          </div>
        )}
        <MultiTrackEditor
          tracks={tracks}
          selectedProject={{ id: message.id, title: message.text || "Live Session" }}
          onTrackUpdate={async (id, data) => {
            try {
              const res = await base44.functions.invoke("mutateTrack", { action: "update", trackId: id, data });
              if (res?.data?.error) throw new Error(res.data.error);
              const updated = res?.data?.track;
              if (
                res?.data?.success !== true ||
                res?.data?.action !== "update" ||
                res?.data?.userId !== currentUser?.id ||
                res?.data?.trackId !== id ||
                res?.data?.parentId !== message.id ||
                updated?.id !== id ||
                updated?.project_id !== message.id
              ) throw new Error("Track was not updated");
              setTracks((current) => current.map((track) => (
                track.id === id ? { ...track, ...updated } : track
              )));
              return updated;
            } catch (error) {
              toast.error("Couldn't update the track. Please try again.");
              return null;
            }
          }}
          onTrackDelete={async (id) => {
            try {
              const res = await base44.functions.invoke("mutateTrack", { action: "delete", trackId: id });
              if (res?.data?.error) throw new Error(res.data.error);
              if (
                res?.data?.success !== true ||
                res?.data?.action !== "delete" ||
                res?.data?.userId !== currentUser?.id ||
                res?.data?.trackId !== id ||
                res?.data?.parentId !== message.id ||
                res?.data?.deleted !== true
              ) {
                throw new Error("Track deletion was not confirmed");
              }
              setTracks((current) => current.filter((track) => track.id !== id));
              return res.data;
            } catch (error) {
              toast.error("Couldn't delete the track. Please try again.");
              return null;
            }
          }}
          canEdit={true}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}