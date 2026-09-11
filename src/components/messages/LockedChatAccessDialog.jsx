import { useEffect, useState } from "react";
import { KeyRound, LockKeyhole, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLockedChats } from "@/lib/LockedChatsContext";
import {
  LOCKED_CHAT_PIN_MAX_LENGTH,
  LOCKED_CHAT_PIN_MIN_LENGTH,
  validateLockedChatPin,
} from "@/lib/lockedChatCrypto";

export default function LockedChatAccessDialog({
  open,
  onOpenChange,
  onUnlocked = null,
  onCancel = null,
  initialMode = "unlock",
}) {
  const {
    security,
    isEntitled,
    setupPin,
    unlock,
    requestPinReset,
    completePinReset,
  } = useLockedChats();
  const [mode, setMode] = useState(initialMode);
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode(initialMode === "reset" ? "reset-request" : security?.configured ? "unlock" : "setup");
    setPin("");
    setConfirmation("");
    setResetCode("");
    setMessage("");
  }, [initialMode, open, security?.configured]);

  const submitPin = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!validateLockedChatPin(pin)) {
      setMessage(`Use a ${LOCKED_CHAT_PIN_MIN_LENGTH}-${LOCKED_CHAT_PIN_MAX_LENGTH} digit PIN.`);
      return;
    }
    if ((mode === "setup" || mode === "reset-complete") && pin !== confirmation) {
      setMessage("PINs do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "setup") {
        await setupPin(pin);
      } else if (mode === "reset-complete") {
        await completePinReset(resetCode.trim(), pin);
      } else {
        await unlock(pin);
      }
      await onUnlocked?.();
      onOpenChange(false);
    } catch (error) {
      if (error.retryAfterMs > 0) {
        setMessage(`Too many attempts. Try again in ${Math.ceil(error.retryAfterMs / 1000)} seconds.`);
      } else {
        setMessage(error.message || "Verification failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const beginReset = async () => {
    setBusy(true);
    setMessage("");
    try {
      await requestPinReset();
      setMode("reset-complete");
      setMessage("A one-time code was sent to your account email.");
    } catch (error) {
      setMessage(error.message || "Could not start PIN reset.");
    } finally {
      setBusy(false);
    }
  };

  const isSetup = mode === "setup";
  const isReset = mode === "reset-request" || mode === "reset-complete";
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && busy) return;
    if (!nextOpen) onCancel?.();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-card border-border motion-reduce:transition-none">
        <DialogHeader>
          <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-2">
            {isReset ? <MailCheck className="w-5 h-5" /> : isSetup ? <KeyRound className="w-5 h-5" /> : <LockKeyhole className="w-5 h-5" />}
          </div>
          <DialogTitle>
            {isSetup ? "Set up locked chats" : isReset ? "Reset locked-chat PIN" : "Unlock locked chats"}
          </DialogTitle>
          <DialogDescription>
            {isSetup
              ? "This app lock hides selected chats on this device. It is not end-to-end encryption and does not hide messages from NaliChat servers."
              : isReset
                ? "Resetting changes only this app lock. Your messages and account password are not changed."
                : "Enter your local PIN to start a five-minute access session. Leaving the app locks chats immediately."}
          </DialogDescription>
        </DialogHeader>

        {mode === "reset-request" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We will send a short-lived verification code to your signed-in account email.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("unlock")} disabled={busy}>Back</Button>
              <Button onClick={beginReset} disabled={busy}>Send verification code</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submitPin} className="space-y-4">
            {mode === "reset-complete" && (
              <div>
                <label htmlFor="locked-chat-reset-code" className="text-sm font-medium">Verification code</label>
                <Input
                  id="locked-chat-reset-code"
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  className="mt-2"
                />
              </div>
            )}
            <div>
              <label htmlFor="locked-chat-pin" className="text-sm font-medium">
                {isSetup || mode === "reset-complete" ? "New PIN" : "PIN"}
              </label>
              <Input
                id="locked-chat-pin"
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, LOCKED_CHAT_PIN_MAX_LENGTH))}
                inputMode="numeric"
                autoComplete="off"
                minLength={LOCKED_CHAT_PIN_MIN_LENGTH}
                maxLength={LOCKED_CHAT_PIN_MAX_LENGTH}
                required
                autoFocus
                className="mt-2"
              />
            </div>
            {(isSetup || mode === "reset-complete") && (
              <div>
                <label htmlFor="locked-chat-pin-confirmation" className="text-sm font-medium">Confirm PIN</label>
                <Input
                  id="locked-chat-pin-confirmation"
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, "").slice(0, LOCKED_CHAT_PIN_MAX_LENGTH))}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  className="mt-2"
                />
              </div>
            )}
            <p className="min-h-5 text-sm text-destructive" role="status" aria-live="polite">{message}</p>
            <DialogFooter>
              {!isSetup && mode !== "reset-complete" && (
                <Button type="button" variant="ghost" onClick={() => setMode("reset-request")} disabled={busy}>
                  Forgot PIN
                </Button>
              )}
              <Button type="submit" disabled={busy || (isSetup && !isEntitled)}>
                {busy ? "Verifying..." : isSetup ? "Set PIN" : mode === "reset-complete" ? "Reset PIN" : "Unlock"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
