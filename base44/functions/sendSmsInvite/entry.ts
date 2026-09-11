import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone } = await req.json();
    if (!phone) {
      return Response.json({ error: 'Missing phone' }, { status: 400 });
    }

    // Validate E.164 phone format to prevent SMS abuse
    const cleanPhone = phone.replace(/[\r\n]/g, '').trim();
    const e164Regex = /^\+?[1-9]\d{6,14}$/;
    if (!e164Regex.test(cleanPhone)) {
      return Response.json({ error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890).' }, { status: 400 });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    if (!accountSid || !authToken || !fromNumber) {
      return Response.json({ error: 'SMS is not configured' }, { status: 503 });
    }

    const appUrl = Deno.env.get('APP_BASE_URL') || req.headers.get('X-Base44-App-Url') || '';
    let inviteLink = '';
    try {
      const parsed = new URL(appUrl);
      if (parsed.protocol !== 'https:') throw new Error('invalid protocol');
      parsed.pathname = '/register';
      parsed.search = '';
      parsed.hash = '';
      inviteLink = parsed.toString();
    } catch {
      return Response.json({ error: 'Invite URL is not configured' }, { status: 500 });
    }

    const inviterName = user.display_name || user.full_name || 'A friend';
    const body = `${inviterName} invited you to collaborate on NaliChat. Join here: ${inviteLink}`;

    const params = new URLSearchParams();
    params.append('To', cleanPhone);
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