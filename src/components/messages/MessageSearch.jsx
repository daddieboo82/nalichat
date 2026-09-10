import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { format } from "date-fns";

export default function MessageSearch({ messages, onClose, onSelectMessage, users }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return messages.filter(m =>
      m.text?.toLowerCase().includes(q) ||
      m.sender_name?.toLowerCase().includes(q) ||
      m.file_name?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query, messages]);

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search messages..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            title="Search messages"
            aria-label="Search messages"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            autoFocus
          />
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground"
            title="Close Search"
            aria-label="Close Search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {query.trim() === "" ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-6">
              <Search className="w-8 h-8 opacity-20" />
              <p className="text-sm">Start typing to search messages</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-6">
              <p className="text-sm">No messages found</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {results.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => { onSelectMessage(msg); onClose(); }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-secondary/60 transition-colors group"
                  title="Jump to message"
                  aria-label="Jump to message"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                      {msg.sender_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary mb-0.5">{msg.sender_name}</p>
                      <p className="text-sm text-foreground/70 line-clamp-2 group-hover:text-foreground transition-colors">
                        {msg.text || `📎 ${msg.file_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {msg.created_date && !isNaN(new Date(msg.created_date).getTime()) ? format(new Date(msg.created_date), "MMM d, h:mm a") : "..."}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {query.trim() && results.length > 0 && (
          <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground text-center">
            Showing {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}