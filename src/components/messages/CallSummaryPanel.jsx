import { Link } from "react-router-dom";
import {
  Check,
  Clock3,
  FileText,
  Loader2,
  Radio,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { callSummaryStatusMessage } from "@/lib/callSummaryClient";

function consentLabel(state) {
  if (state === "accepted") return "Accepted";
  if (state === "call_ended") return "Accepted until call ended";
  if (state === "declined") return "Declined";
  if (state === "revoked") return "Revoked";
  if (state === "expired") return "Expired";
  return "Waiting";
}

function consentIcon(state) {
  if (state === "accepted") return <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />;
  if (state === "requested") return <Clock3 className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />;
  return <X className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />;
}

export default function CallSummaryPanel({ summaryActions, participants = [], inCall = false }) {
  const {
    data,
    error,
    busy,
    capturing,
    entitled,
    subscriptionLoading,
    currentUserId,
    requestConsent,
    respondConsent,
    generate,
    deleteSummary,
  } = summaryActions;
  const session = data?.session;
  const summary = data?.summary;
  const myConsent = data?.consents?.find((item) => item.participant_id === currentUserId);
  const participantName = (id) => {
    const user = participants.find((item) => item.id === id);
    return user?.display_name || user?.full_name || (id === currentUserId ? "You" : "Participant");
  };
  const captureCount = new Set(data?.capture_participant_ids || []).size;
  const allCapturesReady = session
    && captureCount === new Set(session.participant_ids || []).size;
  const canGenerate = session?.status === "ended"
    && session.owner_id === currentUserId
    && allCapturesReady
    && (!summary || summary.status === "failed");

  if (!session && !inCall) return null;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-background/95 p-4 shadow-xl backdrop-blur",
        inCall ? "mt-5 w-full max-w-md" : "absolute right-4 top-20 z-40 w-[min(26rem,calc(100%-2rem))]",
      )}
      aria-labelledby="call-summary-heading"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="call-summary-heading" className="flex items-center gap-2 font-semibold">
            {capturing ? (
              <Radio className="h-4 w-4 text-red-500 motion-safe:animate-pulse" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            )}
            Call summary
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {session
              ? callSummaryStatusMessage(data)
              : "Premium Plus can summarize this call after everyone explicitly consents."}
          </p>
        </div>
        {session && !inCall && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={deleteSummary}
            disabled={busy}
            aria-label="Delete call summary and transcript"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!session && (
        <div className="mt-4">
          {subscriptionLoading ? (
            <p className="text-sm text-muted-foreground">Checking access...</p>
          ) : entitled ? (
            <Button onClick={requestConsent} disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
              Request consent and accept
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link to="/pricing">Upgrade to Premium Plus</Link>
            </Button>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            No audio is recorded until every participant accepts. This 1:1 call records each
            participant&apos;s local microphone, not a server-side mixed stream.
          </p>
        </div>
      )}

      {session && (
        <>
          <div className="mt-3 space-y-1.5" aria-label="Participant consent status">
            {data.consents?.map((consent) => (
              <div key={consent.participant_id} className="flex items-center justify-between text-xs">
                <span>{participantName(consent.participant_id)}</span>
                <span className="flex items-center gap-1">
                  {consentIcon(consent.state)}
                  {consentLabel(consent.state)}
                </span>
              </div>
            ))}
          </div>

          {myConsent?.state === "requested" && session.status === "consent_pending" && (
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => respondConsent("accept")} disabled={busy}>
                Accept
              </Button>
              <Button className="flex-1" variant="destructive" onClick={() => respondConsent("decline")} disabled={busy}>
                Decline
              </Button>
            </div>
          )}

          {myConsent?.state === "accepted" && session.status === "recording" && (
            <Button
              className="mt-4 w-full"
              variant="outline"
              onClick={() => respondConsent("revoke")}
              disabled={busy}
            >
              Revoke consent and stop
            </Button>
          )}

          {session.status === "ended" && !allCapturesReady && (
            <p className="mt-3 text-xs text-muted-foreground">
              Received {captureCount} of {session.participant_ids.length} consented local captures.
              Generation remains locked until all uploads arrive.
            </p>
          )}

          {canGenerate && (
            entitled ? (
              <Button className="mt-4 w-full" onClick={generate} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
                {summary?.status === "failed" ? "Retry summary" : "Generate summary"}
              </Button>
            ) : (
              <Button asChild className="mt-4 w-full">
                <Link to="/pricing">Restore Premium Plus to generate</Link>
              </Button>
            )
          )}

          {summary?.status === "pending" && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              Transcribing consented audio and generating the summary...
            </div>
          )}

          {summary?.status === "completed" && (
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Summary
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{summary.summary}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold">Action items</h4>
                {summary.action_items?.length ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {summary.action_items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No explicit action items.</p>
                )}
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">View transcript</summary>
                <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-muted-foreground">
                  {summary.transcript}
                </p>
              </details>
              <p className="text-[11px] text-muted-foreground">
                Retained until {new Date(summary.available_until).toLocaleDateString()} unless a participant deletes it sooner.
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {error.code === "AI_DAILY_QUOTA_EXHAUSTED"
            ? "Today's AI quota is used up. Try again after the UTC reset or upgrade for a higher limit."
            : error.code === "CALL_SUMMARY_UPGRADE_REQUIRED"
            ? "Premium Plus is required to generate this summary."
            : error.message}
        </p>
      )}
    </section>
  );
}
