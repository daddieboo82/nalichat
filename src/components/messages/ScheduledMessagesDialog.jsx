import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CalendarClock, Loader2, LockKeyhole, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useSubscription } from "@/hooks/useSubscription";
import {
  cancelScheduledMessage,
  createScheduledMessage,
  createScheduledRequestKey,
  defaultLocalScheduleTime,
  listScheduledMessages,
  resolveLocalDateTime,
  toLocalDateTimeInput,
  updateScheduledMessage,
  validateClientSchedule,
} from "@/lib/scheduledMessages";
import { trackScheduledMessageEvent } from "@/lib/scheduledMessageAnalytics";

const FAILURE_MESSAGES = {
  ENTITLEMENT_REVOKED: "Premium access ended before delivery. Resubscribe and schedule it again.",
  SENDER_UNAVAILABLE: "Your account was unavailable at delivery time.",
  SENDER_NOT_MEMBER: "You are no longer a member of this conversation.",
  SENDER_BANNED: "Delivery was blocked because messaging access is restricted.",
  SENDER_TIMED_OUT: "Delivery was blocked by an active messaging timeout.",
  CONVERSATION_UNAVAILABLE: "The conversation is no longer available.",
  MODERATION_REJECTED: "The message was rejected by content moderation.",
  DELIVERY_RETRY_EXHAUSTED: "Delivery repeatedly failed. Schedule a new message to try again.",
};

function errorCode(error) {
  return error && typeof error === "object"
    ? Reflect.get(error, "code") || "SCHEDULE_REQUEST_FAILED"
    : "SCHEDULE_REQUEST_FAILED";
}

function scheduleBounds() {
  const now = Date.now();
  return {
    min: toLocalDateTimeInput(new Date(now + 5 * 60 * 1000)),
    max: toLocalDateTimeInput(new Date(now + 365 * 24 * 60 * 60 * 1000)),
  };
}

function ScheduledRow({ item, onUpdate, onCancel, busy }) {
  const [localTime, setLocalTime] = useState(() => toLocalDateTimeInput(item.scheduled_at));
  const [dstPreference, setDstPreference] = useState("earlier");
  const [error, setError] = useState("");
  const bounds = scheduleBounds();
  const editable = item.status === "scheduled";
  const resolution = useMemo(() => {
    try {
      return resolveLocalDateTime(localTime, dstPreference);
    } catch {
      return null;
    }
  }, [dstPreference, localTime]);

  useEffect(() => {
    const nextLocalTime = toLocalDateTimeInput(item.scheduled_at);
    setLocalTime(nextLocalTime);
    try {
      const nextResolution = resolveLocalDateTime(nextLocalTime);
      const matchingOption = nextResolution.options.find(
        (option) => option.iso === item.scheduled_at,
      );
      setDstPreference(matchingOption?.value || "earlier");
    } catch {
      setDstPreference("earlier");
    }
  }, [item.scheduled_at]);

  const save = async () => {
    setError("");
    try {
      const resolved = resolveLocalDateTime(localTime, dstPreference);
      const scheduledAt = validateClientSchedule(resolved.iso);
      await onUpdate(item.id, scheduledAt);
    } catch (nextError) {
      setError(nextError.message);
    }
  };

  return (
    <li className="rounded-xl border border-border/60 bg-secondary/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.payload.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(item.scheduled_at).toLocaleString()} · {item.status}
          </p>
        </div>
        {editable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onCancel(item.id)}
            disabled={busy}
            aria-label="Cancel scheduled message"
            title="Cancel scheduled message"
          >
            <XCircle className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
      {editable && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor={`scheduled-time-${item.id}`} className="sr-only">
              New delivery time
            </Label>
            <input
              id={`scheduled-time-${item.id}`}
              type="datetime-local"
              value={localTime}
              min={bounds.min}
              max={bounds.max}
              onChange={(event) => {
                setLocalTime(event.target.value);
                setDstPreference("earlier");
              }}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={save} disabled={busy}>
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save time
          </Button>
        </div>
      )}
      {editable && resolution?.ambiguous && (
        <div className="mt-2">
          <Label htmlFor={`scheduled-occurrence-${item.id}`}>Daylight-saving occurrence</Label>
          <select
            id={`scheduled-occurrence-${item.id}`}
            value={dstPreference}
            onChange={(event) => setDstPreference(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            {resolution.options.map((option) => (
              <option key={option.iso} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      )}
      {item.failure_code && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {FAILURE_MESSAGES[item.failure_code] || "Delivery failed."}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
    </li>
  );
}

export default function ScheduledMessagesDialog({
  conversationId,
  draftText,
  onDraftScheduled,
  draftUnavailable = false,
}) {
  const [open, setOpen] = useState(false);
  const [localTime, setLocalTime] = useState(() => defaultLocalScheduleTime());
  const [dstPreference, setDstPreference] = useState("earlier");
  const [formError, setFormError] = useState("");
  const requestRef = useRef(null);
  const queryClient = useQueryClient();
  const { hasEntitlement, isLoading: subscriptionLoading } = useSubscription();
  const isEntitled = hasEntitlement?.("messages.schedule") === true;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local timezone";
  const bounds = scheduleBounds();

  const resolution = useMemo(() => {
    try {
      return resolveLocalDateTime(localTime, dstPreference);
    } catch {
      return null;
    }
  }, [dstPreference, localTime]);

  useEffect(() => {
    requestRef.current = null;
  }, [draftText, localTime, dstPreference]);

  const scheduledQuery = useQuery({
    queryKey: ["scheduledMessages", conversationId],
    queryFn: () => listScheduledMessages(conversationId),
    enabled: open && isEntitled && !!conversationId,
    refetchInterval: open ? 15_000 : false,
  });

  const refresh = () => queryClient.invalidateQueries({
    queryKey: ["scheduledMessages", conversationId],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!draftText.trim()) throw new Error("Write a text message before scheduling it.");
      if (draftUnavailable) throw new Error("Finish or cancel the current reply/edit before scheduling.");
      const resolved = resolveLocalDateTime(localTime, dstPreference);
      const scheduledAt = validateClientSchedule(resolved.iso);
      const fingerprint = `${draftText.trim()}\n${scheduledAt}`;
      if (requestRef.current?.fingerprint !== fingerprint) {
        requestRef.current = { fingerprint, key: createScheduledRequestKey() };
      }
      return createScheduledMessage({
        conversation_id: conversationId,
        payload: { type: "text", text: draftText.trim() },
        scheduled_at: scheduledAt,
        client_request_key: requestRef.current.key,
      });
    },
    onSuccess: async (item) => {
      await refresh();
      onDraftScheduled();
      requestRef.current = null;
      setFormError("");
      setLocalTime(defaultLocalScheduleTime());
      trackScheduledMessageEvent("scheduled_message_created", {
        source: "message_composer",
        status: item.status,
        lead_minutes: Math.round((Date.parse(item.scheduled_at) - Date.now()) / 60000),
      });
      toast.success(`Message scheduled for ${new Date(item.scheduled_at).toLocaleString()}.`);
    },
    onError: (error) => {
      setFormError(error.message);
      trackScheduledMessageEvent("scheduled_message_error", {
        source: "message_composer",
        outcome: "create",
        failure_code: errorCode(error),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, scheduledAt }) => updateScheduledMessage({
      scheduled_message_id: id,
      scheduled_at: scheduledAt,
    }),
    onSuccess: async () => {
      await refresh();
      trackScheduledMessageEvent("scheduled_message_updated", {
        source: "scheduled_message_list",
        outcome: "success",
      });
      toast.success("Delivery time updated.");
    },
    onError: (error) => {
      trackScheduledMessageEvent("scheduled_message_error", {
        source: "scheduled_message_list",
        outcome: "update",
        failure_code: errorCode(error),
      });
      toast.error(error.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelScheduledMessage,
    onSuccess: async () => {
      await refresh();
      trackScheduledMessageEvent("scheduled_message_canceled", {
        source: "scheduled_message_list",
        outcome: "success",
      });
      toast.success("Scheduled message canceled.");
    },
    onError: (error) => {
      trackScheduledMessageEvent("scheduled_message_error", {
        source: "scheduled_message_list",
        outcome: "cancel",
        failure_code: errorCode(error),
      });
      toast.error(error.message);
    },
  });

  const handleOpenChange = (nextOpen) => {
    if (nextOpen && subscriptionLoading) {
      toast.info("Checking Premium access...");
      return;
    }
    if (nextOpen && !subscriptionLoading && !isEntitled) {
      trackScheduledMessageEvent("scheduled_message_prompt", {
        source: "message_composer",
        outcome: "entitlement_required",
      });
      toast.error("Scheduled messages are available with Premium or Premium Plus.");
      return;
    }
    setOpen(nextOpen);
    if (nextOpen) setFormError("");
  };

  const items = scheduledQuery.data || [];
  const busy = createMutation.isPending || updateMutation.isPending || cancelMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={subscriptionLoading}
          className="relative mb-0.5 flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
          title={isEntitled ? "Schedule and manage messages" : "Scheduled messages require Premium"}
          aria-label={isEntitled ? "Schedule and manage messages" : "Scheduled messages, Premium feature"}
        >
          <CalendarClock className="h-5 w-5" />
          {!subscriptionLoading && !isEntitled && (
            <LockKeyhole className="absolute -right-0.5 -top-0.5 h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle>Scheduled messages</DialogTitle>
          <DialogDescription>
            Text messages are stored as UTC instants and delivered by the server while you are offline.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 rounded-xl border border-border/60 p-4" aria-labelledby="schedule-new-heading">
          <h3 id="schedule-new-heading" className="font-semibold">Schedule current text</h3>
          <p className="line-clamp-3 rounded-lg bg-secondary/30 p-2 text-sm">
            {draftText.trim() || "Write a message in the composer first."}
          </p>
          <div>
            <Label htmlFor="new-scheduled-time">Delivery date and time</Label>
            <input
              id="new-scheduled-time"
              type="datetime-local"
              value={localTime}
              min={bounds.min}
              max={bounds.max}
              onChange={(event) => {
                setLocalTime(event.target.value);
                setFormError("");
              }}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              aria-describedby="schedule-time-help"
            />
            <p id="schedule-time-help" className="mt-1 text-xs text-muted-foreground">
              {timezone}. Between 5 minutes and 365 days from now.
            </p>
          </div>
          {resolution?.ambiguous && (
            <div>
              <Label htmlFor="dst-occurrence">Daylight-saving occurrence</Label>
              <select
                id="dst-occurrence"
                value={dstPreference}
                onChange={(event) => setDstPreference(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {resolution.options.map((option) => (
                  <option key={option.iso} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}
          {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
          <Button
            type="button"
            className="w-full"
            disabled={busy || !draftText.trim() || draftUnavailable}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm schedule
          </Button>
        </section>

        <section className="space-y-3" aria-labelledby="scheduled-list-heading">
          <h3 id="scheduled-list-heading" className="font-semibold">Your messages in this chat</h3>
          {scheduledQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading scheduled messages...
            </p>
          ) : scheduledQuery.isError ? (
            <p className="text-sm text-destructive" role="alert">{scheduledQuery.error.message}</p>
          ) : items.length ? (
            <ul className="space-y-2">
              {items.map((item) => (
                <ScheduledRow
                  key={item.id}
                  item={item}
                  busy={busy}
                  onUpdate={(id, scheduledAt) => updateMutation.mutateAsync({ id, scheduledAt })}
                  onCancel={(id) => cancelMutation.mutate(id)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No scheduled messages in this conversation.</p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
