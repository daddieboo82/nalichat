import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, CalendarClock, Loader2, LockKeyhole, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/AuthContext";
import {
  cancelFollowUpReminder,
  createFollowUpReminder,
  createReminderRequestKey,
  defaultReminderTime,
  formatReminderTime,
  listFollowUpReminders,
  localDateTimeToUtc,
  localTimeZoneLabel,
  rescheduleFollowUpReminder,
  toLocalDateTimeInput,
} from "@/lib/followUpReminders";
import { trackFollowUpEvent } from "@/lib/followUpAnalytics";

const ACTIVE_STATUS = "scheduled";

function errorMessage(error) {
  return error?.response?.data?.error
    || error?.data?.error
    || error?.message
    || "Unable to update the reminder.";
}

function delayBucket(remindAt) {
  const hours = (Date.parse(remindAt) - Date.now()) / (60 * 60 * 1000);
  if (hours <= 1) return "under_1h";
  if (hours <= 24) return "1h_to_24h";
  if (hours <= 168) return "1d_to_7d";
  return "over_7d";
}

function statusLabel(reminder) {
  if (reminder.status === "completed") return "Reply received";
  if (reminder.status === "triggered") {
    return reminder.triggered_at ? "Reminder sent" : "Delivery in progress";
  }
  if (reminder.status === "failed") return "Delivery failed";
  if (reminder.status === "canceled") return "Canceled";
  return "Scheduled";
}

export default function FollowUpReminderDialog({
  open,
  onOpenChange,
  conversation,
  sourceMessage,
}) {
  const subscription = useSubscription();
  const { user } = useAuth();
  const isEntitled = subscription.hasEntitlement("reminders.follow_up");
  const [reminders, setReminders] = useState([]);
  const [localTime, setLocalTime] = useState(() => defaultReminderTime());
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const requestKeyRef = useRef(createReminderRequestKey());
  const timezone = useMemo(() => localTimeZoneLabel(), []);

  const loadReminders = async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const loaded = await listFollowUpReminders(user?.id);
      setReminders(loaded.filter((reminder) => (
        !conversation?.id || reminder.conversation_id === conversation.id
      )));
    } catch (error) {
      setLoadError(true);
      toast.error(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setEditingId(null);
    setLocalTime(defaultReminderTime());
    requestKeyRef.current = createReminderRequestKey();
    if (isEntitled) {
      loadReminders();
    } else if (!subscription.isLoading) {
      trackFollowUpEvent("follow_up_prompt_view", {
        source: sourceMessage ? "message_action" : "conversation_menu",
      });
    }
  }, [open, conversation?.id, sourceMessage?.id, isEntitled, subscription.isLoading]);

  const save = async () => {
    const remindAt = localDateTimeToUtc(localTime);
    if (!remindAt || Date.parse(remindAt) <= Date.now()) {
      toast.error("Choose a future date and time.");
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await rescheduleFollowUpReminder(editingId, remindAt, user?.id);
        trackFollowUpEvent("follow_up_reschedule", {
          outcome: "scheduled",
          delay_bucket: delayBucket(remindAt),
        });
        toast.success("Reminder rescheduled.");
      } else if (sourceMessage?.id) {
        await createFollowUpReminder({
          sourceMessageId: sourceMessage.id,
          remindAt,
          requestKey: requestKeyRef.current,
          userId: user?.id,
        });
        trackFollowUpEvent("follow_up_create", {
          outcome: "scheduled",
          delay_bucket: delayBucket(remindAt),
        });
        requestKeyRef.current = createReminderRequestKey();
        toast.success("Follow-up reminder scheduled.");
      }
      setEditingId(null);
      setLocalTime(defaultReminderTime());
      await loadReminders();
    } catch (error) {
      trackFollowUpEvent(editingId ? "follow_up_reschedule" : "follow_up_create", {
        outcome: "failed",
      });
      toast.error(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = async (reminderId) => {
    setIsSaving(true);
    try {
      await cancelFollowUpReminder(reminderId, user?.id);
      trackFollowUpEvent("follow_up_cancel", { outcome: "canceled" });
      toast.success("Reminder canceled.");
      await loadReminders();
    } catch (error) {
      trackFollowUpEvent("follow_up_cancel", { outcome: "failed" });
      toast.error(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlarmClock className="h-5 w-5 text-primary" aria-hidden="true" />
            Follow-up reminders
          </DialogTitle>
          <DialogDescription>
            Get an in-app reminder only if nobody else replies after your message.
          </DialogDescription>
        </DialogHeader>

        {subscription.isLoading ? (
          <div className="flex min-h-32 items-center justify-center" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Checking access</span>
          </div>
        ) : !isEntitled ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
            <LockKeyhole className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h3 className="mt-3 font-heading text-lg font-bold">Premium Plus feature</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Premium Plus adds automatic no-reply follow-ups so important conversations do not slip through.
            </p>
            <Button asChild className="mt-5">
              <Link
                to="/pricing?source=follow_up_reminder&feature=reminders.follow_up"
                onClick={() => trackFollowUpEvent("follow_up_prompt_convert", {
                  source: sourceMessage ? "message_action" : "conversation_menu",
                })}
              >
                Unlock follow-up reminders
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {(sourceMessage || editingId) && (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/20 p-4">
                <div>
                  <Label htmlFor="follow-up-time">
                    {editingId ? "New reminder time" : "Remind me at"}
                  </Label>
                  <Input
                    id="follow-up-time"
                    type="datetime-local"
                    value={localTime}
                    min={toLocalDateTimeInput(new Date(Date.now() + 60_000))}
                    onChange={(event) => setLocalTime(event.target.value)}
                    className="mt-2"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {timezone}. Stored and processed in UTC.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={save} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    {editingId ? "Save new time" : "Schedule reminder"}
                  </Button>
                  {editingId && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setLocalTime(defaultReminderTime());
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                </div>
              </div>
            )}

            <section aria-labelledby="follow-up-list-heading">
              <div className="mb-3 flex items-center justify-between">
                <h3 id="follow-up-list-heading" className="font-semibold">
                  This conversation
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadReminders}
                  disabled={isLoading}
                  aria-label="Refresh reminders"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              {isLoading ? (
                <p className="text-sm text-muted-foreground" aria-live="polite">Loading reminders...</p>
              ) : loadError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4" role="alert">
                  <p className="text-sm font-semibold">Couldn't load reminders</p>
                  <p className="mt-1 text-xs text-muted-foreground">Retry before assuming this conversation has no reminders.</p>
                  <Button type="button" size="sm" variant="outline" className="mt-3" onClick={loadReminders}>
                    Retry
                  </Button>
                </div>
              ) : reminders.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No follow-up reminders in this conversation.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]">
                  {reminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                    >
                      <CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{formatReminderTime(reminder.remind_at)}</p>
                        <p className="text-xs text-muted-foreground">{statusLabel(reminder)}</p>
                      </div>
                      {reminder.status === ACTIVE_STATUS && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(reminder.id);
                              setLocalTime(toLocalDateTimeInput(reminder.remind_at));
                            }}
                          >
                            Reschedule
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => cancel(reminder.id)}
                            aria-label="Cancel reminder"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
