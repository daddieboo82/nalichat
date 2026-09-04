import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, destination, message, senderName } = await req.json();

    if (!destination || !message) {
      return Response.json({ error: 'destination and message are required' }, { status: 400 });
    }

    const name = senderName || user.full_name || 'Someone on NaliChat';

    if (type === 'email') {
      // Prevent open email relay: only allow sending to registered app users.
      // Strip any CRLF sequences from the recipient to prevent header injection.
      const cleanDestination = destination.replace(/[\r\n]/g, '').trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanDestination)) {
        return Response.json({ error: 'Invalid email address' }, { status: 400 });
      }
      const users = await base44.asServiceRole.entities.User.filter({ email: cleanDestination });
      const isRegistered = users.length > 0;
      if (!isRegistered) {
        return Response.json({ error: 'Recipient is not a registered NaliChat user' }, { status: 403 });
      }
      // Sanitize the message body to remove CRLF sequences
      const cleanMessage = message.replace(/[\r\n]{2,}/g, '\n\n').replace(/[\r\n]/g, '\n');
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: cleanDestination,
        subject: `Message from ${name} via NaliChat`,
        body: `${name} sent you a message on NaliChat:\n\n"${cleanMessage}"\n\n---\nReply by joining NaliChat to connect directly.`,
      });
      return Response.json({ success: true, method: 'email' });
    }

    if (type === 'sms') {
      // Prevent open SMS relay: only allow sending to a registered app user's phone,
      // mirroring the email path's "registered user" restriction.
      const cleanPhone = destination.replace(/[\r\n]/g, '').trim();
      const smsUsers = await base44.asServiceRole.entities.User.filter({ phone: cleanPhone });
      const isRegisteredPhone = smsUsers.length > 0;
      if (!isRegisteredPhone) {
        return Response.json({ error: 'Recipient is not a registered NaliChat user' }, { status: 403 });
      }

      // SMS via Twilio
      const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (!accountSid || !authToken || !fromNumber) {
        return Response.json({ 
          error: 'SMS is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in settings.',
          needs_setup: true
        }, { status: 503 });
      }

      const cleanMessage = message.replace(/[\r\n]{2,}/g, '\n\n').replace(/[\r\n]/g, '\n');
      const body = `${name} sent you a message via NaliChat:\n\n"${cleanMessage}"\n\nJoin NaliChat to reply directly.`;

      const formData = new URLSearchParams();
      formData.append('To', cleanPhone);
      formData.append('From', fromNumber);
      formData.append('Body', body);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        console.error('Twilio error:', result);
        return Response.json({ error: result.message || 'Failed to send SMS' }, { status: 500 });
      }

      return Response.json({ success: true, method: 'sms', sid: result.sid });
    }

    return Response.json({ error: 'Invalid type. Use "email" or "sms"' }, { status: 400 });
  } catch (error) {
    console.error('sendExternalMessage error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});