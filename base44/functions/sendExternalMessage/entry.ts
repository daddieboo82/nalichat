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
      // Send via built-in email integration
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: destination,
        subject: `Message from ${name} via NaliChat`,
        body: `${name} sent you a message on NaliChat:\n\n"${message}"\n\n---\nReply by joining NaliChat to connect directly.`,
      });
      return Response.json({ success: true, method: 'email' });
    }

    if (type === 'sms') {
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

      const body = `${name} sent you a message via NaliChat:\n\n"${message}"\n\nJoin NaliChat to reply directly.`;

      const formData = new URLSearchParams();
      formData.append('To', destination);
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