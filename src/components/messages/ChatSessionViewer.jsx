import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import MultiTrackEditor from "../studio/MultiTrackEditor";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authorizedUpload } from "@/lib/authorizedUpload";

export default function ChatSessionViewer({ message, currentUser }) {
  const [tracks, setTracks] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    // Fetch initial tracks
    base44.entities.Track.filter({ project_id: message.id }).then(setTracks);

    // Subscribe to track changes
    const unsubscribe = base44.entities.Track.subscribe((event) => {
      if (event.data?.project_id !== message.id) return;
      if (event.type === 'create') {
        setTracks(prev => [...prev, event.data]);
      } else if (event.type === 'update') {
        setTracks(prev => prev.map(t => t.id === event.id ? event.data : t));
      } else if (event.type === 'delete') {
        setTracks(prev => prev.filter(t => t.id !== event.id));
      }
    });
    return unsubscribe;
  }, [message.id]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setUploading(true);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `track-${Date.now()}.webm`, { type: "audio/webm" });
        try {
          const { file_url } = await authorizedUpload(file, { accept: "audio" });
          await base44.entities.Track.create({
            project_id: message.id,
            name: `Track by ${currentUser?.full_name || "Unknown"}`,
            file_url,
            type: "vocal",
            uploaded_by: currentUser?.id
          });
        } catch (e) {
          console.error(e);
        }
        setUploading(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error(e);
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
        <MultiTrackEditor
          tracks={tracks}
          selectedProject={{ id: message.id, title: message.text || "Live Session" }}
          onTrackUpdate={(id, data) => base44.entities.Track.update(id, data)}
          onTrackDelete={(id) => base44.entities.Track.delete(id)}
          canEdit={true}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}