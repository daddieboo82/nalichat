import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Send, Expand, Shrink, AudioLines, Disc, Activity, Mic, Music, ChevronUp, ChevronDown, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import TutorialTopics from "@/components/ai/TutorialTopics";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/AuthContext";

export default function AiAssistant() {
  const { hasEntitlement, isLoading: subscriptionLoading } = useSubscription();
  const canUseAi = hasEntitlement("ai.standard");
  const canUseBestModel = hasEntitlement("ai.best_model");
  const agentName = canUseBestModel ? "studio_ai_plus" : "studio_ai";
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversation, setConversation] = useState(null);
  const { user } = useAuth();
  const conversationStorageKey = user?.id ? `nali_ai_conversation:${user.id}:${agentName}` : null;
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const unsubRef = useRef(null);
  const spokenIdsRef = useRef(new Set());
  const currentAudioRef = useRef(null);
  const loadingTimerRef = useRef(null);

  const sendAgentText = async (conv, text) => {
    const content = String(text || "").trim();
    if (!conv?.id || !content) throw new Error("Conversation and message are required");
    const requestKey = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `nali-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await base44.functions.invoke("sendAgentMessage", {
      conversation_id: conv.id,
      content,
      request_key: requestKey,
    });
    if (response?.data?.error) {
      const error = new Error(response.data.error);
      error.code = response.data.code;
      error.quota = response.data.quota;
      throw error;
    }
    return response;
  };

  const friendlyNaliError = (error) => {
    const data = error?.response?.data || error?.data || {};
    const code = data.code || error?.code;
    const message = data.error || error?.message || "";
    if (code === "AI_DAILY_QUOTA_EXHAUSTED") {
      const resetAt = data?.quota?.reset_at || data?.reset_at;
      const reset = resetAt ? new Date(resetAt).toLocaleString() : "the next UTC day";
      return `You've reached today's NALI.ai request limit. Your access resets at ${reset}.`;
    }
    if (code === "AI_NOT_ENTITLED" || /premium is required/i.test(message)) {
      return "NALI.ai is available with Premium. Open Settings to review your plan.";
    }
    if (code === "AI_REQUEST_IN_PROGRESS" || code === "AI_REQUEST_ALREADY_DISPATCHED") {
      return "That request is already being handled. Give me a moment to finish it.";
    }
    if (/timed_out|banned/i.test(message)) {
      return "Your account can't use NALI.ai right now. Check your account status in Settings.";
    }
    return "I couldn't complete that request. Please try again.";
  };


  useEffect(() => {
    const handleOpen = (e) => {
      void openChat(e.detail?.greeting).catch((error) => {
        console.error("Nali open error", error);
        toast.error("Couldn't open NALI.ai. Please try again.");
      });
    };
    const handleSendMessage = async (e) => {
      const text = e.detail?.message;
      if (!text) return;
      if (subscriptionLoading || !canUseAi) {
        toast.error(subscriptionLoading ? "Checking your subscription…" : "Premium is required to use NALI.ai.");
        return;
      }
      setOpen(true);
      setMinimized(false);
      try {
        let conv = conversation;
        if (!conv) conv = await initConversation();
        await sendAgentText(conv, text);
      } catch (error) {
        console.error("Nali event send error", error);
        toast.error(friendlyNaliError(error));
      }
    };
    window.addEventListener('open-ai-assistant', handleOpen);
    window.addEventListener('nali-send-message', handleSendMessage);
    // Replay anything dispatched while this code-split chunk was loading.
    window.__naliAiReady = true;
    const queued = window.__naliAiQueue || [];
    window.__naliAiQueue = [];
    queued.forEach(({ type, detail }) => {
      window.dispatchEvent(new CustomEvent(type, { detail }));
    });
    return () => {
      window.__naliAiReady = false;
      window.removeEventListener('open-ai-assistant', handleOpen);
      window.removeEventListener('nali-send-message', handleSendMessage);
    };
  }, [conversation, canUseAi, subscriptionLoading, agentName]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Clean up the conversation subscription and loading timer on unmount
  useEffect(() => () => {
    unsubRef.current?.();
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
  }, []);

  // Speak Nali's replies aloud when voice is enabled
  const speakText = async (text) => {
    // Strip markdown for cleaner speech
    const clean = text.replace(/[#*_`>~|-]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
    if (!clean) return;
    try {
      if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
      setIsSpeaking(true);
      const spokenText = clean.slice(0, 4800);
      const res = await base44.functions.invoke('generate-speech', { text: spokenText, voice: "honey" });
      const audio = new Audio(res.data.url);
      currentAudioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); currentAudioRef.current = null; };
      audio.onerror = () => { setIsSpeaking(false); currentAudioRef.current = null; };
      await audio.play();
    } catch (e) {
      console.error("Nali voice error", e);
      setIsSpeaking(false);
    }
  };

  // Watch for new assistant messages and speak them
  useEffect(() => {
    if (!voiceEnabled || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === "user") return;
    // Use content as a pseudo-id; skip if already spoken
    const id = last.id || last.content?.substring(0, 160);
    if (!id || spokenIdsRef.current.has(id)) return;
    spokenIdsRef.current.add(id);
    speakText(last.content);
  }, [messages, voiceEnabled]);

  // Stop voice when toggled off or panel closes
  useEffect(() => {
    if ((!voiceEnabled || !open) && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
    }
  }, [voiceEnabled, open]);

  useEffect(() => () => {
    return () => { if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; } };
  }, []);

  const bindConversation = (conv) => {
    if (!conv?.id) return null;
    unsubRef.current?.();
    setConversation(conv);
    setMessages(conv.messages || []);
    unsubRef.current = base44.agents.subscribeToConversation(conv.id, (data) => {
      const msgs = data.messages || [];
      setMessages(msgs);
      if (msgs.length && msgs[msgs.length - 1].role !== "user") {
        if (loadingTimerRef.current) { clearTimeout(loadingTimerRef.current); loadingTimerRef.current = null; }
        setLoading(false);
      }
    });
    return conv;
  };

  const initConversation = async () => {
    if (subscriptionLoading) throw new Error("Subscription is still loading");
    if (!canUseAi) {
      toast.error("Premium is required to use NALI.ai.");
      throw new Error("AI entitlement required");
    }
    if (conversation) return conversation;

    if (conversationStorageKey) {
      try {
        const savedId = sessionStorage.getItem(conversationStorageKey);
        if (savedId) {
          const restored = await base44.agents.getConversation(savedId);
          if (restored?.id && (!restored.created_by_id || restored.created_by_id === user?.id)) {
            return bindConversation(restored);
          }
        }
      } catch (error) {
        console.warn("Nali conversation restore failed:", error);
      }
      try { sessionStorage.removeItem(conversationStorageKey); } catch {}
    }

    const conv = await base44.agents.createConversation({ agent_name: agentName });
    if (conversationStorageKey) {
      try { sessionStorage.setItem(conversationStorageKey, conv.id); } catch {}
    }
    return bindConversation(conv);
  };

  const openChat = async (greeting) => {
    if (subscriptionLoading) {
      toast.info("Checking your subscription…");
      return;
    }
    if (!canUseAi) {
      toast.error("Premium is required to use NALI.ai.");
      return;
    }
    setOpen(true);
    setMinimized(false);
    if (!conversation) {
      const conv = await initConversation();
      // Only send a contextual greeting when one was explicitly provided.
      // Opening Nali by itself should not consume a model request.
      if (greeting) await sendAgentText(conv, greeting);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendText = async (text) => {
    if (!text.trim() || loading) return;
    setInput("");
    setLoading(true);
    let conv = conversation;
    try {
      if (!conv) conv = await initConversation();
      await sendAgentText(conv, text.trim());
      // loading is cleared by the subscription when Nali's reply arrives,
      // but set a safety timeout in case the subscription never fires
      // (agent error, WebSocket drop, or very long tool call)
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = setTimeout(async () => {
        loadingTimerRef.current = null;
        try {
          const fresh = await base44.agents.getConversation(conv.id);
          const freshMessages = fresh?.messages || [];
          setMessages(freshMessages);
          const last = freshMessages[freshMessages.length - 1];
          if (last && last.role !== "user") {
            setLoading(false);
            return;
          }
          toast.info("Nali is still working on that request. I'll show the reply as soon as it arrives.");
        } catch (refreshError) {
          console.error("Nali conversation refresh error", refreshError);
          toast.info("Nali is still working, but the live connection was interrupted. Reopen the assistant to refresh.");
        }
      }, 60000);
    } catch (err) {
      console.error("Nali send error", err);
      if (loadingTimerRef.current) { clearTimeout(loadingTimerRef.current); loadingTimerRef.current = null; }
      setLoading(false);
      setMessages(prevMsgs => [...prevMsgs, {
        role: "assistant",
        content: friendlyNaliError(err),
      }]);
    }
  };

  const send = () => sendText(input);

  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      toast.error("Speech recognition error: " + event.error);
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className={cn(
          "fixed bottom-28 md:bottom-8 right-4 z-[999999] bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 flex flex-col transition-all duration-300",
          minimized ? "w-64 max-w-[calc(100vw-32px)] h-14" : expanded ? "w-[calc(100vw-32px)] sm:w-[440px] h-[640px] max-h-[calc(100dvh-120px)] sm:max-h-[80vh]" : "w-[calc(100vw-32px)] sm:w-96 h-[500px] max-h-[calc(100dvh-120px)] sm:max-h-[80vh]"
        )}>
          {/* Header */}
          <div className="relative flex items-center gap-1 sm:gap-3 px-3 sm:px-4 py-3 border-b border-primary/20 bg-gradient-to-r from-background via-primary/10 to-background rounded-t-2xl shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none" />
            
            <div className="relative w-9 h-9 rounded-full border border-primary/40 bg-card flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
              <AudioLines className="w-5 h-5 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0 pl-2 sm:pl-0 relative z-10">
              <div className="flex items-center gap-2">
                <p className="font-heading font-black text-base tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">NALI.ai</p>
                <div className="flex gap-[3px] items-center h-4 ml-1">
                  <div className={cn("w-[3px] bg-primary rounded-full", isSpeaking ? "waveform-bar" : "h-1")} />
                  <div className={cn("w-[3px] bg-primary rounded-full", isSpeaking ? "waveform-bar" : "h-1")} style={{ animationDelay: "0.2s" }} />
                  <div className={cn("w-[3px] bg-primary rounded-full", isSpeaking ? "waveform-bar" : "h-1")} style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
              {!minimized && <p className="text-[10px] text-primary/80 uppercase tracking-widest font-bold mt-0.5">Studio Co-Producer</p>}
            </div>
            {!minimized && (
              <button onClick={() => {
                setVoiceEnabled(v => {
                  const next = !v;
                  if (next) {
                    // Unlock audio on this user gesture so TTS can play after async API calls
                    try {
                      const ctx = new (window.AudioContext || window.webkitAudioContext)();
                      ctx.resume().then(() => ctx.close()).catch(() => {});
                    } catch {}
                  }
                  return next;
                });
              }} aria-label={voiceEnabled ? "Mute Nali voice" : "Enable Nali voice"} title={voiceEnabled ? "Voice on — tap to mute Nali" : "Enable Nali's voice"} className={cn("p-2 sm:p-1 transition-colors", voiceEnabled ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                {voiceEnabled ? <Volume2 className="w-5 h-5 sm:w-4 sm:h-4" /> : <VolumeX className="w-5 h-5 sm:w-4 sm:h-4" />}
              </button>
            )}
            {!minimized && (
              <button onClick={() => setExpanded(v => !v)} aria-label={expanded ? "Shrink" : "Expand"} className="text-muted-foreground hover:text-foreground p-2 sm:p-1" title={expanded ? "Shrink" : "Expand"}>
                {expanded ? <Shrink className="w-5 h-5 sm:w-4 sm:h-4" /> : <Expand className="w-5 h-5 sm:w-4 sm:h-4" />}
              </button>
            )}
            <button onClick={() => setMinimized(v => !v)} aria-label={minimized ? "Restore" : "Minimize"} title={minimized ? "Restore" : "Minimize"} className="text-muted-foreground hover:text-foreground p-2 sm:p-1">
              {minimized ? <ChevronUp className="w-5 h-5 sm:w-4 sm:h-4" /> : <ChevronDown className="w-5 h-5 sm:w-4 sm:h-4" />}
            </button>
            <button onClick={() => setOpen(false)} aria-label="Close" title="Close" className="text-muted-foreground hover:text-foreground p-2 sm:p-1 mr-[-4px]">
              <X className="w-6 h-6 sm:w-4 sm:h-4" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" style={{ animationDuration: '2s' }} />
                      <div className="absolute inset-2 rounded-full border-r-2 border-accent animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }} />
                      <div className="absolute inset-0 flex items-center justify-center bg-card rounded-full shadow-[0_0_30px_rgba(var(--primary-rgb),0.15)]">
                        <Disc className="w-10 h-10 text-primary animate-pulse" />
                      </div>
                    </div>
                    <p className="text-lg font-heading font-black tracking-tight mb-2">SYSTEMS ONLINE{user ? `, ${user.full_name?.split(" ")[0].toUpperCase()}` : ""}</p>
                    <p className="text-sm text-muted-foreground mb-8 max-w-[280px] mx-auto leading-relaxed">I'm Nali, your AI co-producer. Ready to mix, master, and manage your creative flow.</p>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { text: "Generate cover art for my track", icon: <Disc className="w-4 h-4" /> },
                        { text: "Suggest some trending tags", icon: <Activity className="w-4 h-4" /> },
                        { text: "Write my artist bio", icon: <Mic className="w-4 h-4" /> },
                        { text: "Create a fresh playlist", icon: <Music className="w-4 h-4" /> }
                      ].map((s, i) => (
                        <button key={i} onClick={() => { setInput(s.text); inputRef.current?.focus(); }} className="flex items-center gap-3 text-xs bg-secondary/50 hover:bg-primary/10 border border-border hover:border-primary/30 text-foreground px-4 py-3 rounded-xl transition-all group">
                          <span className="text-primary group-hover:scale-110 transition-transform">{s.icon}</span>
                          <span className="text-left font-medium">{s.text}</span>
                        </button>
                      ))}
                    </div>

                    <TutorialTopics onPick={sendText} />
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role !== "user" && (
                      <div className="w-7 h-7 rounded-full border border-primary/30 bg-card flex items-center justify-center shrink-0 mt-1 shadow-[0_0_10px_rgba(var(--primary-rgb),0.2)]">
                        <AudioLines className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground rounded-tr-sm" 
                        : "bg-secondary/80 border border-border/50 text-foreground rounded-tl-sm backdrop-blur-sm"
                    )}>
                      {msg.role === "user" ? (
                        <p>{msg.content}</p>
                      ) : (
                        <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full border border-primary/30 bg-card flex items-center justify-center shrink-0 mt-1 shadow-[0_0_10px_rgba(var(--primary-rgb),0.2)]">
                      <AudioLines className="w-3.5 h-3.5 text-primary animate-pulse" />
                    </div>
                    <div className="bg-secondary/80 border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3 backdrop-blur-sm shadow-sm flex items-center">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              {/* Always visible quick actions */}
              {messages.length > 0 && (
                <div className="px-3 pb-2 pt-0 flex gap-2 overflow-x-auto no-scrollbar border-t border-border/50 bg-background/50 shrink-0">
                  <div className="flex gap-2 min-w-max mt-2">
                    {[
                      { text: "Explain music theory", icon: <Music className="w-3 h-3" /> },
                      { text: "Generate cover art", icon: <Disc className="w-3 h-3" /> },
                      { text: "Suggest trending tags", icon: <Activity className="w-3 h-3" /> },
                      { text: "Write my artist bio", icon: <Mic className="w-3 h-3" /> }
                    ].map((s, i) => (
                      <button key={i} onClick={() => { setInput(s.text); inputRef.current?.focus(); }} className="flex items-center gap-1.5 text-[10px] sm:text-xs bg-secondary hover:bg-primary/20 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                        <span className="text-primary/70">{s.icon}</span>
                        <span>{s.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Input */}
              <div className="p-3 border-t border-border/50 bg-background/50 backdrop-blur-md flex gap-2 shrink-0">
                <div className="relative flex-1">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-mono font-bold">{'>'}</div>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask Nali about your music, projects, or anything else..."
                    className="w-full bg-secondary/40 border border-primary/20 rounded-xl pl-8 pr-10 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/70"
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  />
                  <button
                    onClick={handleMicClick}
                    title="Voice Input"
                    aria-label="Voice input"
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors",
                      isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                    )}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  title="Send message"
                  aria-label="Send message"
                  className="w-10 h-10 bg-primary/20 text-primary border border-primary/30 rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-primary/20 disabled:hover:text-primary"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}