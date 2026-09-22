import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Mail, MessageSquare, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { copyToClipboard } from "@/lib/clipboard";

export default function GlobalInviteDialog({ open, onOpenChange }) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);
  const [phone, setPhone] = useState("");
  const [smsStatus, setSmsStatus] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const lastUserIdRef = useRef(user?.id || null);

  useEffect(() => {
    const nextUserId = user?.id || null;
    if (lastUserIdRef.current === nextUserId) return;
    lastUserIdRef.current = nextUserId;
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setCopied(false);
    setPhone("");
    setSmsStatus(null);
    onOpenChange(false);
  }, [user?.id, onOpenChange]);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const inviteUrl = `${window.location.origin}/register`;

  const openSms = () => {
    setSmsStatus(null);
    const trimmed = phone.trim();
    if (!trimmed) {
      setSmsStatus({ type: "error", message: "Please enter a phone number." });
      return;
    }
    const normalized = trimmed.replace(/[\s()-]/g, "");
    if (!/^\+?\d{7,15}$/.test(normalized)) {
      setSmsStatus({ type: "error", message: "Enter a valid phone number with country code (e.g. +1 555 123 4567)." });
      return;
    }

    const body = `I'm using NaliBase to collaborate on music. Join me here: ${inviteUrl}`;
    window.location.href = `sms:${encodeURIComponent(normalized)}?&body=${encodeURIComponent(body)}`;
    setSmsStatus({ type: "success", message: "Your SMS app was opened with the invite ready to send." });
  };

  const handleCopy = async () => {
    const copiedSuccessfully = await copyToClipboard(inviteUrl);
    if (!copiedSuccessfully) {
      setCopied(false);
      toast({ title: "Copy failed", description: "Please copy the invite link manually.", variant: "destructive" });
      return;
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      copyTimerRef.current = null;
      setCopied(false);
    }, 2000);
    toast({ title: "Copied!", description: "Invite link copied to clipboard." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Invite Collaborators</DialogTitle>
          <DialogDescription>Share this link to invite others to join NaliBase</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input readOnly value={inviteUrl} className="flex-1 rounded-lg bg-secondary/50 border-0 text-sm" />
            <Button size="icon" className="w-10 h-10 rounded-lg bg-primary hover:bg-primary/90" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Share this link anywhere — anyone can use it to join and start collaborating with you.
          </p>

          <div className="bg-secondary/40 rounded-lg p-4 border border-border/40">
            <label className="text-sm font-medium flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Invite via SMS
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setSmsStatus(null); }}
                placeholder="+1 555 123 4567"
                className="flex-1 text-sm rounded-lg bg-background border-border"
              />
              <Button
                onClick={openSms}
                disabled={!phone.trim()}
                className="shrink-0 rounded-lg"
              >
                Open SMS
              </Button>
            </div>
            {smsStatus ? (
              <p className={`text-xs mt-2 flex items-center gap-1.5 font-medium ${smsStatus.type === "success" ? "text-green-500" : "text-destructive"}`}>
                {smsStatus.type === "success" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {smsStatus.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                NaliBase opens your SMS app; you review and send the invite yourself.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-lg"
              onClick={() => {
                const subject = "Join me on NaliBase";
                const body = `I'm using NaliBase to collaborate on music. Join me here: ${inviteUrl}`;
                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              }}
            >
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>

            {navigator.share && (
              <Button
                variant="outline"
                className="flex-1 rounded-lg"
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: 'Join NaliBase',
                      text: "Explore NaliBase with me — connect, create, discover and collaborate.",
                      url: inviteUrl,
                    });
                  } catch (err) {
                    if (err?.name !== "AbortError") {
                      console.error("Share failed", err);
                      toast({ title: "Share failed", description: "Please try again.", variant: "destructive" });
                    }
                  }
                }}
              >
                Share...
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
