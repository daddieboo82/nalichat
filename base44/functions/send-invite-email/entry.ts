import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Validates email format to prevent injection of malformed recipients
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to } = await req.json();

    // Validate recipient email
    if (!to || !to.trim()) {
      return Response.json({ error: 'Recipient email is required' }, { status: 400 });
    }
    const recipient = to.trim();
    if (!EMAIL_REGEX.test(recipient)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Construct the invite link server-side from trusted app URL — never accept
    // a client-supplied link (prevents phishing/link injection)
    const appUrl =
      req.headers.get('X-Base44-App-Url') ||
      Deno.env.get('WIX_CHECKOUT_APP_URL') ||
      '';
    if (!appUrl) {
      return Response.json(
        { error: 'Server is not configured with an app URL' },
        { status: 500 }
      );
    }
    const inviteLink = `${appUrl}/register`;

    const inviterName = user.display_name || user.full_name || 'A friend';
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient,
      subject: 'Join me on NaliChat',
      body: `Hey! ${inviterName} invited you to collaborate on NaliChat. Join here: ${inviteLink}`,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('send-invite-email error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});