import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

// Validates email format to prevent injection of malformed recipients
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const rate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'email_invite',
      10,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { to } = await req.json();

    // Validate recipient email
    if (typeof to !== 'string' || !to.trim()) {
      return Response.json({ error: 'Recipient email is required' }, { status: 400 });
    }
    if (to.length > 320) {
      return Response.json({ error: 'Email address is too long' }, { status: 400 });
    }
    const recipient = to.trim();
    if (!EMAIL_REGEX.test(recipient)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Construct the invite link server-side from trusted app URL — never accept
    // a client-supplied link (prevents phishing/link injection)
    const appUrl =
      Deno.env.get('APP_BASE_URL') ||
      Deno.env.get('WIX_CHECKOUT_APP_URL') ||
      'https://nalichat.org';
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