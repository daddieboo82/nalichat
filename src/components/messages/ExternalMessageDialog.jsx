import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, CheckCircle, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ExternalMessageDialog({ open, onOpenChange }) {
  const [destination, setDestination] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // null | "success" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  const reset = () => {
    setDestination("");
    setMessage("");
    setStatus(null);
    setErrorMsg("");
  };

  const handleSend = async () => {
    if (!destination.trim() || !message.trim()) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await base44.functions.invoke("sendExternalMessage", {
        type: "email",
        destination: destination.trim(),
        message: message.trim(),
      });
      if (res.data?.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(res.data?.error || "Failed to send");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message);
    } finally {
      setSending(false);
    }
  };

  const placeholder = "recipient@example.com";
  const label = "Email address";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border max-w-md">
         <DialogHeader>
           <DialogTitle className="font-heading">Send External Message</DialogTitle>
           <DialogDescription>Send an email message to a registered NaliChat user</DialogDescription>
         </DialogHeader>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <p className="font-heading font-semibold text-lg">Request Accepted</p>
            <p className="text-sm text-muted-foreground">
              If that address can receive NaliChat messages, it will be delivered.
            </p>
            <Button onClick={reset} variant="outline" className="mt-2">Send Another</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
              <Input
                placeholder={placeholder}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                title={label}
                aria-label={label}
                className="bg-secondary/50 border-0 rounded-xl"
                type="email"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Message</label>
              <Textarea
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                title="Message content"
                aria-label="Message content"
                className="bg-secondary/50 border-0 rounded-xl resize-none h-28"
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right mt-1">{message.length}/1000</p>
            </div>

            {status === "error" && (
              <div className="flex gap-2 items-start p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{errorMsg || "Something went wrong. Please try again."}</p>
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={sending || !destination.trim() || !message.trim()}
              className="w-full gap-2"
            >
              {sending ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Email</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}