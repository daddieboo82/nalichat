import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bot, X, Send, Minimize2, Maximize2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [user, setUser] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const initConversation = async () => {
    if (conversation) return conversation;
    const conv = await base44.agents.createConversation({ agent_name: "studio_ai" });
    setConversation(conv);
    // Subscribe
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
    });
    return conv;
  };

  const openChat = async () => {
    setOpen(true);
    setMinimized(false);
    if (!conversation) {
      const conv = await initConversation();
      // Send greeting
      await base44.agents.addMessage(conv, {
        role: "user",
        content: "Hi! What can you help me with on RecordStudio?"
      });
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    let conv = conversation;
    if (!conv) conv = await initConversation();
    await base44.agents.addMessage(conv, { role: "user", content: text });
    setLoading(false);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={openChat}
          className="fixed bottom-24 right-4 z-40 w-11 h-11 rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          <Sparkles className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className={cn(
          "fixed bottom-24 right-4 z-50 bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 flex flex-col transition-all duration-300",
          minimized ? "w-64 h-14" : "w-80 sm:w-96 h-[500px]"
        )}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-accent/10 rounded-t-2xl shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-sm">Nali</p>
              {!minimized && <p className="text-[10px] text-muted-foreground">AI Creative Assistant</p>}
            </div>
            <button onClick={() => setMinimized(v => !v)} className="text-muted-foreground hover:text-foreground p-1">
              {minimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-semibold">Hi{user ? `, ${user.display_name || user.full_name?.split(" ")[0]}` : ""}! 👋</p>
                    <p className="text-xs text-muted-foreground mt-1">I'm Nali, your creative AI. Ask me anything!</p>
                    <div className="flex flex-col gap-1.5 mt-4">
                      {["Help me write my bio", "How do I earn XP?", "Give me art ideas"].map(s => (
                        <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }} className="text-xs bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl text-left transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role !== "user" && (
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[80%] rounded-xl px-3 py-2 text-xs",
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
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
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <div className="bg-secondary rounded-xl px-3 py-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex gap-2 shrink-0">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask Nali anything..."
                  className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}