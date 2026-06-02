import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, Mic, Image, Music, File, Play, Pause, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function MessageBubble({ message, isOwn }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const renderContent = () => {
    if (message.type === "audio") {
      return (
        <div className="flex items-center gap-3">
          <audio ref={audioRef} src={message.file_url} onEnded={() => setPlaying(false)} />
          <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            {playing ? <Pause className="w-3.5 h-3.5 text-primary" /> : <Play className="w-3.5 h-3.5 text-primary ml-0.5" />}
          </button>
          <div className="flex gap-0.5 items-end h-5">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="w-1 bg-primary/40 rounded-full" style={{ height: `${Math.random() * 16 + 4}px` }} />
            ))}
          </div>
          {message.duration && <span className="text-[10px] text-muted-foreground ml-1">{Math.floor(message.duration / 60)}:{String(Math.floor(message.duration % 60)).padStart(2, '0')}</span>}
        </div>
      );
    }
    if (message.type === "file" || message.type === "session") {
      const icon = message.file_type?.startsWith("audio") ? Music : message.file_type?.startsWith("image") ? Image : File;
      const Icon = icon;
      return (
        <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:opacity-80">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{message.file_name || "File"}</p>
            {message.file_size && <p className="text-[10px] text-muted-foreground">{(message.file_size / 1024 / 1024).toFixed(1)} MB</p>}
          </div>
        </a>
      );
    }
    if (message.type === "image") {
      return (
        <div>
          <img src={message.file_url} alt="" className="rounded-lg max-w-[280px] max-h-[200px] object-cover" />
          {message.text && <p className="text-sm mt-2">{message.text}</p>}
        </div>
      );
    }
    return <p className="text-sm leading-relaxed">{message.text}</p>;
  };

  return (
    <div className={cn("flex gap-2 mb-3", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn && (
        <Avatar className="w-7 h-7 shrink-0 mt-1">
          <AvatarImage src={message.sender_avatar} />
          <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
            {message.sender_name?.[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("max-w-[70%]", isOwn && "items-end")}>
        {!isOwn && <p className="text-[10px] text-muted-foreground mb-1 ml-1">{message.sender_name}</p>}
        <div className={cn(
          "rounded-2xl px-4 py-2.5",
          isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary rounded-bl-md"
        )}>
          {renderContent()}
        </div>
        <p className={cn("text-[10px] text-muted-foreground mt-1", isOwn ? "text-right mr-1" : "ml-1")}>
          {format(new Date(message.created_date), "h:mm a")}
        </p>
      </div>
    </div>
  );
}

export default function ChatView({ conversation, messages, currentUser, users, onSendMessage }) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage({ text: text.trim(), type: "text" });
    setText("");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const fileType = file.type.startsWith("image") ? "image" : file.type.startsWith("audio") ? "audio" : "file";
    onSendMessage({
      text: "",
      type: fileType,
      file_url,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
    });
    setUploading(false);
    e.target.value = "";
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const file = new File([blob], "voice-message.webm", { type: "audio/webm" });
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onSendMessage({ text: "", type: "audio", file_url, file_name: "Voice Message", file_type: "audio/webm" });
      setUploading(false);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const getOtherUser = () => {
    if (conversation?.type === "group") return null;
    const otherId = conversation?.participant_ids?.find(id => id !== currentUser?.id);
    return users?.find(u => u.id === otherId);
  };

  const other = getOtherUser();
  const displayName = conversation?.type === "group" ? conversation.name : (other?.display_name || other?.full_name || "Select a conversation");

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Music className="w-8 h-8 text-primary/40" />
          </div>
          <p className="font-heading font-semibold text-lg">Select a conversation</p>
          <p className="text-sm mt-1">or start a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center px-6 gap-3 shrink-0 bg-card/50 backdrop-blur-sm">
        <Avatar className="w-9 h-9">
          <AvatarImage src={other?.avatar_url || conversation?.avatar_url} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">{displayName?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-heading font-semibold text-sm">{displayName}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{other?.role || "Group"}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-1">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === currentUser?.id} />
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="rounded-xl shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Paperclip className="w-5 h-5" />
          </Button>
          {isRecording ? (
            <div className="flex-1 flex items-center gap-3 bg-destructive/10 rounded-xl px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm text-destructive font-medium">Recording...</span>
              <Button size="sm" variant="ghost" onClick={stopRecording} className="ml-auto">
                <X className="w-4 h-4" /> Stop
              </Button>
            </div>
          ) : (
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              className="bg-secondary/50 border-0 rounded-xl"
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={uploading}
            />
          )}
          {text.trim() ? (
            <Button size="icon" className="rounded-xl shrink-0 bg-primary hover:bg-primary/90" onClick={handleSend}>
              <Send className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className={cn("rounded-xl shrink-0", isRecording && "text-destructive")}
              onClick={isRecording ? stopRecording : startRecording}
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}