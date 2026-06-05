import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Mail, MessageSquare, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function GlobalInviteDialog({ open, onOpenChange }) {
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const { toast } = useToast();

  const inviteUrl = `https://nalichat.org/register`;

  const sendSms = async () => {
    setSmsStatus(null);
    if (!phone.trim()) {
      setSmsStatus({ type: "error", message: "Please enter a phone number." });
      return;
    }
    setSendingSms(true);
    try {
      const res = await base44.functions.invoke("sendSmsInvite", { phone: phone.trim(), link: inviteUrl });
      if (res.data?.success) {
        toast({ title: "Invite sent via SMS!" });
        setSmsStatus({ type: "success", message: `Invite sent to ${phone.trim()}!` });
        setPhone("");
      } else {
        setSmsStatus({ type: "error", message: res.data?.error || "Failed to send SMS." });
      }
    } catch (err) {
      console.error("Failed to send SMS invite:", err);
      setSmsStatus({ type: "error", message: "Failed to send SMS. Please try again." });
    } finally {
      setSendingSms(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Invite link copied to clipboard." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Invite Collaborators</DialogTitle>
          <DialogDescription>Share this link to invite others to join NaliChat</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              readOnly
              value={inviteUrl}
              className="flex-1 rounded-lg bg-secondary/50 border-0 text-sm"
            />
            <Button
              size="icon"
              className="w-10 h-10 rounded-lg bg-primary hover:bg-primary/90"
              onClick={handleCopy}
            >
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
              <Button onClick={sendSms} disabled={sendingSms} className="shrink-0 rounded-lg">
                {sendingSms ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
              </Button>
            </div>
            {smsStatus ? (
              <p className={`text-xs mt-2 flex items-center gap-1.5 font-medium ${smsStatus.type === "success" ? "text-green-500" : "text-destructive"}`}>
                {smsStatus.type === "success" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {smsStatus.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                Include the country code (e.g. +1 for US numbers).
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-lg"
              onClick={() => {
                const subject = "Join me on NaliChat";
                const body = `I'm using NaliChat to collaborate on music. Join me here: ${inviteUrl}`;
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
                      title: 'Join NaliChat',
                      text: "I'm using NaliChat to collaborate on music. Join me here!",
                      url: inviteUrl,
                    });
                  } catch (err) {
                    console.error("Share failed", err);
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