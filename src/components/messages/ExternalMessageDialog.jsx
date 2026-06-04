import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, Send, CheckCircle, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

export default function ExternalMessageDialog({ open, onOpenChange }) {
  const [tab, setTab] = useState("email"); // "email" | "sms"
  const [destination, setDestination] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // null | "success" | "error" | "needs_setup"
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
        type: tab,
        destination: destination.trim(),
        message: message.trim(),
      });
      if (res.data?.needs_setup) {
        setStatus("needs_setup");
        setErrorMsg(res.data.error);
      } else if (res.data?.success) {
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

  const placeholder = tab === "email" ? "recipient@example.com" : "+1 (555) 000-0000";
  const label = tab === "email" ? "Email address" : "Phone number";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border max-w-md">
         <DialogHeader>
           <DialogTitle className="font-heading">Send External Message</DialogTitle>
           <DialogDescription>Send an email or SMS message to anyone</DialogDescription>
         </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-2 p-1 bg-secondary/30 rounded-xl">
          <button
            onClick={() => { setTab("email"); reset(); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all",
              tab === "email" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Mail className="w-4 h-4" /> Email
          </button>
          <button
            onClick={() => { setTab("sms"); reset(); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all",
              tab === "sms" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Phone className="w-4 h-4" /> SMS
          </button>
        </div>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <p className="font-heading font-semibold text-lg">Message Sent!</p>
            <p className="text-sm text-muted-foreground">
              Your message was delivered to {destination}
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
                className="bg-secondary/50 border-0 rounded-xl"
                type={tab === "email" ? "email" : "tel"}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Message</label>
              <Textarea
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="bg-secondary/50 border-0 rounded-xl resize-none h-28"
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right mt-1">{message.length}/1000</p>
            </div>

            {status === "needs_setup" && (
              <div className="flex gap-2 items-start p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">SMS Setup Required</p>
                  <p className="text-xs mt-0.5 text-yellow-400/80">Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in app settings to enable SMS.</p>
                </div>
              </div>
            )}

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
                <><Send className="w-4 h-4" /> Send {tab === "email" ? "Email" : "SMS"}</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}