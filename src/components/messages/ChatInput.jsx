import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Paperclip, Mic, X, StopCircle, UploadCloud, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { resumableUpload } from "@/lib/resumableUpload";

const EMOJI_LIST = ["😀","😂","🥰","😎","🤩","😮","😢","😡","👍","👎","❤️","🔥","🎵","🎤","🎸","🥁","💯","🙏","✨","🎉","💪","🤝","🎶","🎧"];


export default function ChatInput({ onSend, replyTo, onCancelReply, disabled, onTyping }) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploads, setUploads] = useState([]); // [{name, progress, done}]
  const [dragOver, setDragOver] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [text]);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    const payload = { text: text.trim(), type: "text" };
    if (replyTo) {
      payload.reply_to_text = replyTo.text || `[${replyTo.type}]`;
      payload.reply_to_sender = replyTo.sender_name;
      payload.reply_to_id = replyTo.id;
    }
    onSend(payload);
    setText("");
    onCancelReply?.();
  };

  const uploadFile = async (file) => {
    const id = `${file.name}-${Date.now()}`;
    setUploads(u => [...u, { id, name: file.name, progress: 0, done: false, error: false }]);

    const updateProgress = (pct) => {
      setUploads(u => u.map(x => x.id === id ? { ...x, progress: pct } : x));
    };

    let file_url;
    try {
      file_url = await resumableUpload(file, updateProgress);
    } catch (err) {
      setUploads(u => u.map(x => x.id === id ? { ...x, error: true } : x));
      setTimeout(() => setUploads(u => u.filter(x => x.id !== id)), 3000);
      return;
    }

    setUploads(u => u.map(x => x.id === id ? { ...x, progress: 100, done: true } : x));
    setTimeout(() => setUploads(u => u.filter(x => x.id !== id)), 1200);

    const isImage = file.type.startsWith("image");
    const isAudio = file.type.startsWith("audio");
    const isVideo = file.type.startsWith("video");
    const type = isImage ? "image" : isAudio ? "audio" : isVideo ? "video" : "file";
    onSend({ text: "", type, file_url, file_name: file.name, file_size: file.size, file_type: file.type });
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) uploadFile(file); // parallel
    e.target.value = "";
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) uploadFile(file);
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const id = `voice-${Date.now()}`;
      setUploads(u => [...u, { id, name: "Voice Message", progress: 0, done: false, error: false }]);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setUploads(u => u.map(x => x.id === id ? { ...x, progress: 100, done: true } : x));
        setTimeout(() => setUploads(u => u.filter(x => x.id !== id)), 1200);
        onSend({ text: "", type: "audio", file_url, file_name: "Voice Message", file_type: "audio/webm", duration: recordingTime });
      } catch {
        setUploads(u => u.map(x => x.id === id ? { ...x, error: true } : x));
        setTimeout(() => setUploads(u => u.filter(x => x.id !== id)), 3000);
      }
      setRecordingTime(0);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const cancelRecording = () => {
    mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const anyUploading = uploads.some(u => !u.done && !u.error);

  return (
    <div
      className={cn("border-t border-border/40 backdrop-blur-xl shrink-0 transition-all", dragOver && "bg-primary/5")}
      style={{ background: "hsl(240 10% 5% / 0.95)" }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 pt-3 flex items-center gap-2 animate-in slide-in-from-bottom-1 duration-200">
          <div className="flex-1 border-l-2 border-primary/70 pl-3 py-1 bg-primary/5 rounded-r-lg">
            <p className="text-[10px] text-primary font-semibold">{replyTo.sender_name}</p>
            <p className="text-xs text-muted-foreground/80 truncate">{replyTo.text || `[${replyTo.type}]`}</p>
          </div>
          <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-secondary/60 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="px-4 pt-2 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex flex-wrap gap-1 p-2 bg-secondary/30 rounded-xl border border-border/40 max-h-24 overflow-y-auto">
            {EMOJI_LIST.map(e => (
              <button key={e} onClick={() => { setText(t => t + e); setShowEmoji(false); textareaRef.current?.focus(); }}
                className="text-xl p-1 rounded-lg hover:bg-secondary/80 transition-all hover:scale-110 active:scale-95">
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload progress bars */}
      {uploads.length > 0 && (
        <div className="px-4 pt-2 space-y-1.5">
          {uploads.map(u => (
            <div key={u.id} className="flex items-center gap-2">
              <UploadCloud className={cn("w-3.5 h-3.5 shrink-0", u.error ? "text-destructive" : "text-primary")} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground shrink-0 ml-1">
                    {u.error ? "Failed" : u.done ? "Done ✓" : `${u.progress}%`}
                  </p>
                </div>
                <div className="h-0.5 bg-secondary/60 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", u.error ? "bg-destructive" : u.done ? "bg-accent" : "bg-primary")}
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-2.5 sm:p-3 flex items-end gap-1.5 sm:gap-2">
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileChange} accept="*/*" />

        {/* Emoji */}
        <button
          onClick={() => setShowEmoji(v => !v)}
          disabled={isRecording}
          className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 mb-0.5 touch-manipulation",
            showEmoji ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-primary hover:bg-primary/10")}
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Attach */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={anyUploading || isRecording}
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0 mb-0.5 touch-manipulation"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Recording or textarea */}
        {isRecording ? (
          <div className="flex-1 flex items-center gap-2 sm:gap-3 bg-destructive/10 border border-destructive/30 rounded-2xl px-3 sm:px-4 py-2.5 h-10">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
            <span className="text-sm text-destructive font-mono font-bold">{fmt(recordingTime)}</span>
            <span className="text-xs text-muted-foreground hidden sm:block">Recording...</span>
            <button onClick={cancelRecording} className="ml-auto text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-secondary/60 transition-all touch-manipulation">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping?.();
            }}
            placeholder={dragOver ? "📎 Drop files here..." : "Message..."}
            className="flex-1 bg-secondary/30 border border-border/50 rounded-2xl px-4 py-2.5 text-sm resize-none min-h-[40px] max-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 placeholder:text-muted-foreground/50 transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={anyUploading}
            rows={1}
          />
        )}

        {/* Send or Record */}
        {text.trim() ? (
          <button
            onClick={handleSend}
            disabled={disabled}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center hover:opacity-90 transition-all shrink-0 mb-0.5 touch-manipulation shadow-lg shadow-primary/30 hover:scale-105 active:scale-95"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        ) : isRecording ? (
          <button
            onClick={stopRecording}
            className="w-10 h-10 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/90 transition-all shrink-0 mb-0.5 touch-manipulation shadow-lg shadow-destructive/30"
          >
            <StopCircle className="w-5 h-5 text-white" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={anyUploading || disabled}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0 mb-0.5 touch-manipulation"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}