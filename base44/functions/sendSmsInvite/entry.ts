import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone, link } = await req.json();
    if (!phone || !link) {
      return Response.json({ error: 'Missing phone or link' }, { status: 400 });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    const inviterName = user.display_name || user.full_name || 'A friend';
    const body = `${inviterName} invited you to collaborate on NaliChat. Join here: ${link}`;

    const params = new URLSearchParams();
    params.append('To', phone);
    params.append('From', fromNumber);
    params.append('Body', body);

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    const data = await resp.json();
    if (!resp.ok) {
      console.error('Twilio error:', data);
      return Response.json({ error: data.message || 'Failed to send SMS' }, { status: 500 });
    }

    return Response.json({ success: true, sid: data.sid });
  } catch (error) {
    console.error('sendSmsInvite error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});