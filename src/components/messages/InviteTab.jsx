import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Copy, Check, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';

export default function InviteTab() {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);
  const [phone, setPhone] = useState('');
  const [smsStatus, setSmsStatus] = useState(null);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const getOrigin = () => (typeof window !== 'undefined' ? window.location.origin : '');
  const inviteLink = `${getOrigin()}/register`;

  const copyLink = async () => {
    const copiedSuccessfully = await copyToClipboard(inviteLink);
    if (!copiedSuccessfully) {
      setCopied(false);
      toast.error("Couldn't copy the invite link. Please copy it manually.");
      return;
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      copyTimerRef.current = null;
      setCopied(false);
    }, 2000);
  };

  const openSms = () => {
    setSmsStatus(null);
    const trimmed = phone.trim();
    if (!trimmed) {
      setSmsStatus({ type: 'error', message: 'Please enter a phone number.' });
      return;
    }
    const normalized = trimmed.replace(/[\s()-]/g, '');
    if (!/^\+?\d{7,15}$/.test(normalized)) {
      setSmsStatus({ type: 'error', message: 'Enter a valid phone number with country code (e.g. +1 555 123 4567).' });
      return;
    }

    const body = `I'm using NaliChat to collaborate on music. Join me here: ${inviteLink}`;
    window.location.href = `sms:${encodeURIComponent(normalized)}?&body=${encodeURIComponent(body)}`;
    setSmsStatus({ type: 'success', message: 'Your SMS app was opened with the invite ready to send.' });
  };

  const openEmail = () => {
    const subject = 'Join me on NaliChat';
    const body = `I'm using NaliChat to collaborate on music. Join me here: ${inviteLink}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="max-w-md w-full">
        <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>

        <h2 className="text-2xl font-heading font-bold mb-2">Invite Collaborators</h2>
        <p className="text-muted-foreground mb-6">Share your unique link and start collaborating with others.</p>

        <div className="bg-card rounded-lg p-4 mb-6 border border-border/40">
          <div className="flex items-center gap-2">
            <Input value={inviteLink} readOnly className="flex-1 bg-transparent border-0 text-sm text-center" />
            <Button size="sm" variant="ghost" onClick={copyLink} className="shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {copied ? 'Copied to clipboard!' : 'Click to copy invite link'}
          </p>
        </div>

        <Button onClick={copyLink} className="w-full mb-3">Copy Invite Link</Button>
        <Button variant="outline" onClick={openEmail} className="w-full mb-6">
          <Mail className="w-4 h-4 mr-2" />
          Open Email App
        </Button>

        <div className="bg-card rounded-lg p-4 mb-3 border border-border/40 text-left">
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
              className="flex-1 text-sm"
            />
            <Button onClick={openSms} className="shrink-0">Open SMS</Button>
          </div>
          {smsStatus ? (
            <p className={`text-xs mt-2 flex items-center gap-1.5 font-medium ${smsStatus.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
              {smsStatus.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              {smsStatus.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">
              NaliChat opens your SMS app; you review and send the invite yourself.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          NaliChat never sends invite email or SMS messages to arbitrary recipients on your behalf.
        </p>
      </div>
    </div>
  );
}
