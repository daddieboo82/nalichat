import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Copy, Check, MessageSquare, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';

export default function InviteTab() {
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null); // { type: 'success' | 'error', message }

  const getOrigin = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  const inviteLink = `${getOrigin()}/register`;

  const copyLink = async () => {
    const copiedSuccessfully = await copyToClipboard(inviteLink);
    if (!copiedSuccessfully) {
      setCopied(false);
      toast.error("Couldn't copy the invite link. Please copy it manually.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendSms = async () => {
    setSmsStatus(null);
    const trimmed = phone.trim();
    if (!trimmed) {
      setSmsStatus({ type: 'error', message: 'Please enter a phone number.' });
      return;
    }
    // Validate E.164-style number: optional +, 7-15 digits
    const normalized = trimmed.replace(/[\s()-]/g, '');
    if (!/^\+?\d{7,15}$/.test(normalized)) {
      setSmsStatus({ type: 'error', message: 'Enter a valid phone number with country code (e.g. +1 555 123 4567).' });
      return;
    }
    setSendingSms(true);
    try {
      const res = await base44.functions.invoke('sendSmsInvite', { phone: trimmed });
      if (res.data?.success) {
        toast.success('Invite sent via SMS!');
        setSmsStatus({ type: 'success', message: `Invite sent to ${trimmed}!` });
        setPhone('');
      } else {
        setSmsStatus({ type: 'error', message: res.data?.error || 'Failed to send SMS.' });
      }
    } catch (err) {
      console.error('Failed to send SMS invite:', err);
      setSmsStatus({ type: 'error', message: 'Failed to send SMS. Please try again.' });
    } finally {
      setSendingSms(false);
    }
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
            <Input
              value={inviteLink}
              readOnly
              className="flex-1 bg-transparent border-0 text-sm text-center"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={copyLink}
              className="shrink-0"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {copied ? 'Copied to clipboard!' : 'Click to copy invite link'}
          </p>
        </div>

        <Button
          onClick={copyLink}
          className="w-full mb-6"
        >
          Copy Invite Link
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
            <Button onClick={sendSms} disabled={sendingSms} className="shrink-0">
              {sendingSms ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
            </Button>
          </div>
          {smsStatus ? (
            <p className={`text-xs mt-2 flex items-center gap-1.5 font-medium ${smsStatus.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
              {smsStatus.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              {smsStatus.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">
              Include the country code (e.g. +1 for US numbers).
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Share this link with anyone you want to invite to collaborate
        </p>
      </div>
    </div>
  );
}