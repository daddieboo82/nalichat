import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, Mic, X, Image as ImageIcon, Film, FileText, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChatInput({ onSend, replyTo, onCancelReply, disabled }) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const isImage = file.type.startsWith("image");
    const isAudio = file.type.startsWith("audio");
    const isVideo = file.type.startsWith("video");
    const type = isImage ? "image" : isAudio ? "audio" : isVideo ? "video" : "file";
    onSend({
      text: "",
      type,
      file_url,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
    });
    setUploading(false);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) await uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) await uploadFile(file);
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
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onSend({ text: "", type: "audio", file_url, file_name: "Voice Message", file_type: "audio/webm", duration: recordingTime });
      setUploading(false);
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

  return (
    <div
      className={cn("border-t border-border bg-card/60 backdrop-blur-sm transition-colors", dragOver && "bg-primary/5")}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 pt-3 flex items-center gap-2">
          <div className="flex-1 border-l-2 border-primary pl-2 py-0.5">
            <p className="text-[10px] text-primary font-semibold">{replyTo.sender_name}</p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.text || `[${replyTo.type}]`}</p>
          </div>
          <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-3 flex items-end gap-2">
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileChange} accept="*/*" />

        {/* Attach */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || isRecording}
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 mb-0.5"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Recording state */}
        {isRecording ? (
          <div className="flex-1 flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-2.5 h-10">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
            <span className="text-sm text-destructive font-mono font-semibold">{fmt(recordingTime)}</span>
            <span className="text-xs text-muted-foreground">Recording voice...</span>
            <button onClick={cancelRecording} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={dragOver ? "Drop files here..." : "Message..."}
            className="flex-1 bg-secondary/50 border border-border rounded-2xl px-4 py-2.5 text-sm resize-none min-h-[40px] max-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={uploading}
            rows={1}
          />
        )}

        {/* Send or Record */}
        {text.trim() ? (
          <button
            onClick={handleSend}
            disabled={disabled}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0 mb-0.5"
          >
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        ) : isRecording ? (
          <button
            onClick={stopRecording}
            className="w-9 h-9 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/90 transition-colors shrink-0 mb-0.5"
          >
            <StopCircle className="w-5 h-5 text-white" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={uploading || disabled}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 mb-0.5"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>

      {uploading && (
        <div className="px-4 pb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          Uploading...
        </div>
      )}
    </div>
  );
}