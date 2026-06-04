import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Paperclip, Mic, X, StopCircle, UploadCloud, Smile, Layers, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { resumableUpload } from "@/lib/resumableUpload";
import { sounds } from "@/hooks/use-sound";
import { motion, AnimatePresence } from "framer-motion";
import EmojiReactionPicker from "./EmojiReactionPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function ChatInput({ onSend, replyTo, onCancelReply, editingMessage, onCancelEdit, disabled, onTyping }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text || "");
      textareaRef.current?.focus();
    }
  }, [editingMessage]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploads, setUploads] = useState([]); // [{name, progress, done}]
  const [dragOver, setDragOver] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [sessionName, setSessionName] = useState("New Recording Session");
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
    sounds.upload();
    const payload = { text: text.trim(), type: "text" };
    if (replyTo) {
      payload.reply_to_text = replyTo.text || `[${replyTo.type}]`;
      payload.reply_to_sender = replyTo.sender_name;
      payload.reply_to_id = replyTo.id;
    }
    onSend(payload);
    setText("");
    onCancelReply?.();
    onCancelEdit?.();
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
    const isAudio = file.type.startsWith("audio") || !!file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i);
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
    sounds.recStart();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      sounds.error();
      return;
    }
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
    sounds.recStop();
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
      className={cn("w-full rounded-3xl transition-all duration-300", dragOver && "bg-primary/5")}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Edit preview */}
      {editingMessage && (
        <div className="px-4 pt-3 flex items-center gap-2 animate-in slide-in-from-bottom-1 duration-200">
          <div className="flex-1 border-l-2 border-accent/70 pl-3 py-1.5 bg-accent/5 rounded-r-lg">
            <p className="text-[10px] text-accent font-semibold mb-0.5">Editing Message</p>
            <p className="text-xs text-muted-foreground/80 truncate">{editingMessage.text}</p>
          </div>
          <button onClick={() => { onCancelEdit?.(); setText(""); }} className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-secondary/60 transition-all" title="Cancel Edit" aria-label="Cancel Edit">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && !editingMessage && (
        <div className="px-4 pt-3 flex items-center gap-2 animate-in slide-in-from-bottom-1 duration-200">
          <div className="flex-1 border-l-2 border-primary/70 pl-3 py-1 bg-primary/5 rounded-r-lg">
            <p className="text-[10px] text-primary font-semibold">{replyTo.sender_name}</p>
            <p className="text-xs text-muted-foreground/80 truncate">{replyTo.text || `[${replyTo.type}]`}</p>
          </div>
          <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-secondary/60 transition-all" title="Cancel Reply" aria-label="Cancel Reply">
            <X className="w-4 h-4" />
          </button>
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

        {/* Start Session / Additional Features */}
        <Popover open={showFeatures} onOpenChange={setShowFeatures}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={isRecording || anyUploading}
              className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 mb-0.5 touch-manipulation",
                showFeatures ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-primary hover:bg-primary/10")}
              title="Additional Features"
              aria-label="Additional Features"
            >
              <Layers className="w-5 h-5 text-indigo-400" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-64 p-3 rounded-xl border border-border/60 shadow-xl bg-card/95 backdrop-blur-md mb-2">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Features</h4>
              
              <div className="space-y-2">
                <div className="group relative">
                  <div className="flex items-center gap-3 px-2 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className="block text-sm font-medium text-foreground">Live Session</span>
                    </div>
                  </div>
                  <div className="px-2 pb-2 pt-1">
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={sessionName}
                        onChange={e => setSessionName(e.target.value)}
                        className="flex-1 bg-secondary/50 border border-border/50 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary/50 text-foreground"
                        placeholder="Session name"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && sessionName.trim()) {
                            onSend({ text: sessionName.trim(), type: "session" });
                            setShowFeatures(false);
                            setSessionName("New Recording Session");
                          }
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (sessionName.trim()) {
                            onSend({ text: sessionName.trim(), type: "session" });
                            setShowFeatures(false);
                            setSessionName("New Recording Session");
                          }
                        }}
                        className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md hover:bg-primary/90"
                        title="Start Live Session"
                        aria-label="Start Live Session"
                      >
                        Start
                      </button>
                    </div>
                  </div>
                </div>
                
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-primary/10 transition-colors text-left"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowFeatures(false);
                  }}
                  title="Share Music"
                  aria-label="Share Music"
                >
                  <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-foreground">Share Music</span>
                    <span className="block text-[10px] text-muted-foreground">Upload audio or stems</span>
                  </div>
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Emoji */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setShowEmoji(!showEmoji); }}
            disabled={isRecording}
            className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 mb-0.5 touch-manipulation",
              showEmoji ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-primary hover:bg-primary/10")}
            title="Add Emoji"
            aria-label="Add Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmoji && (
            <EmojiReactionPicker 
              position="bottom" 
              onSelect={(emoji) => { 
                setText(t => t + emoji); 
                setShowEmoji(false);
                textareaRef.current?.focus(); 
              }} 
              onClose={() => setShowEmoji(false)} 
            />
          )}
        </div>

        {/* Attach */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
          disabled={anyUploading || isRecording}
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0 mb-0.5 touch-manipulation"
          title="Attach File"
          aria-label="Attach File"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Recording or textarea */}
        {isRecording ? (
          <motion.div
            className="flex-1 flex items-center gap-2 sm:gap-3 rounded-2xl px-3 sm:px-4 py-2.5 h-10 relative overflow-hidden"
            style={{ background: "hsl(0 72% 51% / 0.1)", border: "1px solid hsl(0 72% 51% / 0.4)" }}
            animate={{ boxShadow: ["0 0 0px hsl(0 72% 51% / 0)", "0 0 16px hsl(0 72% 51% / 0.3)", "0 0 0px hsl(0 72% 51% / 0)"] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            {/* pulsing waveform */}
            <div className="flex items-center gap-0.5 h-5 shrink-0">
              {[0.4,0.8,1,0.7,0.5,0.9,0.6].map((h, i) => (
                <motion.div key={i} className="w-0.5 rounded-full bg-destructive"
                  animate={{ scaleY: [h, 1, h] }}
                  transition={{ repeat: Infinity, duration: 0.5 + i * 0.07, ease: "easeInOut" }}
                  style={{ height: `${h * 20}px`, transformOrigin: "center" }}
                />
              ))}
            </div>
            <span className="text-sm text-destructive font-mono font-bold">{fmt(recordingTime)}</span>
            <span className="text-xs text-muted-foreground hidden sm:block">Recording…</span>
            <button onClick={cancelRecording} className="ml-auto text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-secondary/60 transition-all touch-manipulation" title="Cancel Recording" aria-label="Cancel Recording">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
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
          <motion.button
            type="button"
            onClick={(e) => { e.preventDefault(); handleSend(); }}
            disabled={disabled}
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.08 }}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shrink-0 mb-0.5 touch-manipulation shadow-lg shadow-primary/40"
            title="Send Message"
            aria-label="Send Message"
          >
            <Send className="w-4 h-4 text-white" />
          </motion.button>
        ) : isRecording ? (
          <motion.button
            type="button"
            onClick={(e) => { e.preventDefault(); stopRecording(); }}
            whileTap={{ scale: 0.88 }}
            className="w-10 h-10 rounded-full bg-destructive flex items-center justify-center shrink-0 mb-0.5 touch-manipulation shadow-lg shadow-destructive/40"
            animate={{ boxShadow: ["0 0 8px hsl(0 72% 51% / 0.4)", "0 0 20px hsl(0 72% 51% / 0.7)", "0 0 8px hsl(0 72% 51% / 0.4)"] }}
            transition={{ repeat: Infinity, duration: 1 }}
            title="Stop Recording"
            aria-label="Stop Recording"
          >
            <StopCircle className="w-5 h-5 text-white" />
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={(e) => { e.preventDefault(); startRecording(); }}
            disabled={anyUploading || disabled}
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.1 }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 mb-0.5 touch-manipulation"
            title="Record Audio"
            aria-label="Record Audio"
          >
            <Mic className="w-5 h-5" />
          </motion.button>
        )}
      </div>
    </div>
  );
}