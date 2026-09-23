import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Loader2, Search, X } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { EntitlementGate, useEntitlement } from "@/components/subscription/EntitlementGate";

const RESULT_LIMIT = 30;
const MESSAGE_TYPES = [
  ["text", "Text"],
  ["image", "Image"],
  ["audio", "Audio"],
  ["file", "File"],
  ["session", "Session"],
];

function localDayBoundary(value, isEnd) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day + (isEnd ? 1 : 0)).toISOString();
}

function resultLabel(message) {
  if (message.text) return message.text;
  if (message.file_name) return `Attachment: ${message.file_name}`;
  return `${message.type || "Message"} message`;
}

export default function MessageSearch({
  conversation,
  onClose,
  onSelectMessage,
  users,
}) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [senderId, setSenderId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [messageType, setMessageType] = useState("");
  const [order, setOrder] = useState("newest");
  const [results, setResults] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const { isEntitled } = useEntitlement("search.advanced");

  const participantUsers = useMemo(() => {
    const participantIds = new Set(conversation?.participant_ids || []);
    return users.filter((user) => participantIds.has(user.id));
  }, [conversation?.participant_ids, users]);

  const hasAdvancedFilters = Boolean(senderId || dateFrom || dateTo || messageType);
  const hasCriteria = Boolean(query.trim() || hasAdvancedFilters);

  const searchPayload = (offset = 0) => ({
    conversation_id: conversation.id,
    query: query.trim() || undefined,
    sender_id: senderId || undefined,
    date_from: localDayBoundary(dateFrom, false),
    date_to: localDayBoundary(dateTo, true),
    types: messageType ? [messageType] : undefined,
    order,
    limit: RESULT_LIMIT,
    offset,
  });

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setError("");
    setNextOffset(null);

    if (!hasCriteria || (hasAdvancedFilters && !isEntitled)) {
      setResults([]);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await base44.functions.invoke("searchMessages", searchPayload());
        if (response?.data?.error) throw new Error(response.data.error);
        if (requestSequence.current !== sequence) return;
        setResults(response.data?.results || []);
        setNextOffset(response.data?.pagination?.next_offset ?? null);
      } catch (searchError) {
        if (requestSequence.current !== sequence) return;
        setResults([]);
        setError(
          searchError?.response?.data?.error
          || searchError?.message
          || "Message search failed. Please try again.",
        );
      } finally {
        if (requestSequence.current === sequence) setIsLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    conversation.id,
    dateFrom,
    dateTo,
    hasAdvancedFilters,
    hasCriteria,
    isEntitled,
    messageType,
    order,
    query,
    senderId,
  ]);

  const loadMore = async () => {
    if (nextOffset === null || isLoadingMore) return;
    const sequence = requestSequence.current;
    setIsLoadingMore(true);
    setError("");
    try {
      const response = await base44.functions.invoke(
        "searchMessages",
        searchPayload(nextOffset),
      );
      if (response?.data?.error) throw new Error(response.data.error);
      if (requestSequence.current !== sequence) return;
      setResults((current) => [...current, ...(response.data?.results || [])]);
      setNextOffset(response.data?.pagination?.next_offset ?? null);
    } catch (searchError) {
      if (requestSequence.current !== sequence) return;
      setError(
        searchError?.response?.data?.error
        || searchError?.message
        || "More results could not be loaded.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  const clearFilters = () => {
    setSenderId("");
    setDateFrom("");
    setDateTo("");
    setMessageType("");
    setOrder("newest");
  };

  return (
    <div
      className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-stretch justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-search-title"
    >
      <div className="bg-card border border-border/60 rounded-none shadow-2xl w-full h-full min-h-0 flex flex-col overflow-hidden sm:h-auto sm:max-w-2xl sm:max-h-[85dvh] sm:rounded-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <Search className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <h2 id="message-search-title" className="sr-only">Search messages</h2>
          <input
            type="search"
            placeholder="Search message text, sender, or file name..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search messages"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className="h-9 px-3 flex items-center gap-2 rounded-lg hover:bg-secondary/60 transition-colors text-sm text-muted-foreground"
            aria-expanded={showFilters}
            aria-controls="advanced-message-filters"
          >
            <Filter className="w-4 h-4" aria-hidden="true" />
            Filters
            {hasAdvancedFilters && (
              <span className="w-2 h-2 rounded-full bg-primary" aria-label="Filters active" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground"
            title="Close search"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showFilters && (
          <div id="advanced-message-filters" className="border-b border-border/40 p-4">
            {isEntitled ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Sender
                    <select
                      value={senderId}
                      onChange={(event) => setSenderId(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">Anyone</option>
                      {participantUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.display_name || user.full_name || "Unknown member"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    Message type
                    <select
                      value={messageType}
                      onChange={(event) => setMessageType(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">All types</option>
                      {MESSAGE_TYPES.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    From date
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(event) => setDateFrom(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    Through date
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(event) => setDateTo(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    Sort order
                    <select
                      value={order}
                      onChange={(event) => setOrder(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  >
                    Clear filters
                  </button>
                </div>
              </>
            ) : (
              <EntitlementGate
                entitlement="search.advanced"
                title="Advanced message filters"
                description="Premium unlocks powerful filters for sender, date, and message type so you can find the right conversation faster."
                source="message_search_filters"
              >
                <div />
              </EntitlementGate>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 sm:min-h-48 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]" aria-live="polite">
          {isLoading ? (
            <div className="flex h-full min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Searching messages...
            </div>
          ) : error ? (
            <div className="flex h-full min-h-48 items-center justify-center p-6 text-center text-sm text-destructive">
              {error}
            </div>
          ) : !hasCriteria ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
              <Search className="w-8 h-8 opacity-20" aria-hidden="true" />
              <p className="text-sm">Enter text or choose advanced filters to search this conversation.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
              <p className="text-sm">
                {nextOffset === null ? "No messages found" : "No matches in this result window"}
              </p>
              {nextOffset !== null && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Search older messages
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {results.map((message) => (
                <button
                  type="button"
                  key={message.id}
                  onClick={async () => {
                    try {
                      await onSelectMessage(message);
                      onClose();
                    } catch {
                      setError("That message could not be opened. Please try again.");
                    }
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-secondary/60 transition-colors group"
                  title="Jump to message"
                  aria-label={`Jump to message from ${message.sender_name || "unknown sender"}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                      {message.sender_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary mb-0.5">
                        {message.sender_name || "Unknown sender"}
                      </p>
                      <p className="text-sm text-foreground/70 line-clamp-2 group-hover:text-foreground transition-colors">
                        {resultLabel(message)}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {message.created_date && !Number.isNaN(new Date(message.created_date).getTime())
                          ? format(new Date(message.created_date), "MMM d, h:mm a")
                          : "Unknown date"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {nextOffset !== null && (
                <div className="flex justify-center py-3">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    Load more
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground text-center">
            Showing {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
