import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Download, FileText, FileType, Loader2, LockKeyhole } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { exportConversationFile } from "@/lib/chatExport";
import { trackPaywallEvent } from "@/lib/paywallAnalytics";

const FORMATS = [
  {
    id: "markdown",
    label: "Markdown",
    description: "Portable plain text with links and message metadata.",
    icon: FileText,
  },
  {
    id: "pdf",
    label: "PDF",
    description: "Paginated document generated privately on this device.",
    icon: FileType,
  },
];

function errorMessage(error) {
  const code = error?.response?.data?.code || error?.data?.code || error?.code;
  if (code === "CHAT_EXPORT_NOT_ENTITLED") {
    return "Your subscription no longer includes conversation export.";
  }
  if (code === "NOT_A_PARTICIPANT" || error?.response?.status === 403) {
    return "You no longer have access to this conversation.";
  }
  if (error?.response?.status === 401) {
    return "Sign in again before exporting this conversation.";
  }
  return "The conversation could not be exported. Please try again.";
}

export default function ChatExportDialog({ open, onOpenChange, conversationId }) {
  const { hasEntitlement, isLoading: isSubscriptionLoading, isError: isSubscriptionError, refetch } = useSubscription();
  const isEntitled = hasEntitlement("chat.export");
  const [format, setFormat] = useState("markdown");
  const [stage, setStage] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const operationRef = useRef(0);
  const isWorking = stage === "authorizing" || stage === "generating";

  useEffect(() => {
    if (open && !isSubscriptionLoading && !isEntitled) {
      trackPaywallEvent("entitlement_prompt_view", {
        entitlement: "chat.export",
        source: "chat_export",
      });
    }
  }, [isEntitled, isSubscriptionLoading, open]);

  useEffect(() => {
    if (!open) {
      operationRef.current += 1;
      setStage("idle");
      setProgress(0);
      setStatus("");
    }
  }, [open]);

  useEffect(() => () => {
    operationRef.current += 1;
  }, []);

  const cancelExport = () => {
    operationRef.current += 1;
    setStage("idle");
    setProgress(0);
    setStatus("Export canceled.");
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && isWorking) cancelExport();
    onOpenChange(nextOpen);
  };

  const handleExport = async () => {
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setStage("authorizing");
    setProgress(15);
    setStatus("Securely loading the full conversation...");

    try {
      const response = await base44.functions.invoke("exportConversation", {
        conversation_id: conversationId,
      });
      if (operationRef.current !== operation) return;

      const model = response?.data;
      if (!model?.conversation || !Array.isArray(model.messages)) {
        throw new Error("Invalid export response");
      }

      setStage("generating");
      setProgress(45);
      setStatus(`Generating ${format === "pdf" ? "PDF" : "Markdown"} on this device...`);
      await exportConversationFile(model, format, {
        isCancelled: () => operationRef.current !== operation,
        onProgress: (value) => {
          if (operationRef.current === operation) {
            setProgress(45 + Math.round(value * 0.5));
          }
        },
      });
      if (operationRef.current !== operation) return;

      setStage("complete");
      setProgress(100);
      setStatus(
        model.limits?.truncated
          ? `Export downloaded. It contains the first ${model.limits.messageCap} messages.`
          : "Export downloaded.",
      );
    } catch (error) {
      if (operationRef.current !== operation || error?.name === "AbortError") return;
      setStage("error");
      setProgress(0);
      setStatus(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Export conversation</DialogTitle>
          <DialogDescription>
            Download a private copy of this conversation.
          </DialogDescription>
        </DialogHeader>

        {isSubscriptionLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Checking export access...
          </div>
        ) : !isEntitled ? (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <LockKeyhole className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold">Export with Premium</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Premium and Premium Plus include Markdown and PDF conversation exports.
                Messaging remains available on the Free plan.
              </p>
            </div>
            {isSubscriptionError && (
              <p className="text-sm text-destructive" role="alert">
                We could not verify your subscription. Export stays locked until access is verified.
              </p>
            )}
            <div className="flex justify-center gap-3">
              {isSubscriptionError && (
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              )}
              <Button asChild onClick={() => trackPaywallEvent("entitlement_prompt_convert", {
                entitlement: "chat.export",
                source: "chat_export",
              })}>
                <Link to="/pricing">View Premium plans</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <p>
                  Exports contain conversation content and attachment links. Store and share the file carefully.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Format</p>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Export format">
                {FORMATS.map(({ id, label, description, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={format === id}
                    disabled={isWorking}
                    onClick={() => setFormat(id)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      format === id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <Icon className="mb-2 h-5 w-5 text-primary" aria-hidden="true" />
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Edited messages are marked, deleted messages are omitted by the service, and unsupported media is listed as attachment metadata. Exports include at most 5,000 messages.
            </p>

            {(isWorking || status) && (
              <div className="space-y-2" aria-live="polite">
                {isWorking && <Progress value={progress} aria-label="Export progress" />}
                <p className={`text-xs ${stage === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                  {status}
                </p>
              </div>
            )}

            <DialogFooter>
              {isWorking ? (
                <Button type="button" variant="outline" onClick={cancelExport}>
                  Cancel export
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Close
                </Button>
              )}
              <Button type="button" onClick={handleExport} disabled={isWorking || !conversationId}>
                {isWorking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {isWorking ? "Exporting..." : `Export ${format === "pdf" ? "PDF" : "Markdown"}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
