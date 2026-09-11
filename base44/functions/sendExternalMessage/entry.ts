import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

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
      'external_message',
      40,
    );
    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { type, destination, message } = await req.json();

    if (typeof destination !== 'string' || typeof message !== 'string') {
      return Response.json({ error: 'destination and message must be strings' }, { status: 400 });
    }
    if (!destination.trim() || !message.trim()) {
      return Response.json({ error: 'destination and message are required' }, { status: 400 });
    }
    if (message.length > 5000) {
      return Response.json({ error: 'Message must be 5000 characters or fewer' }, { status: 413 });
    }

    const name = String(user.display_name || user.full_name || 'Someone on NaliChat')
      .replace(/[\r\n]/g, ' ')
      .trim()
      .slice(0, 80) || 'Someone on NaliChat';

    if (type === 'email') {
      // Prevent open email relay: only allow sending to registered app users.
      // Strip any CRLF sequences from the recipient to prevent header injection.
      const cleanDestination = destination.replace(/[\r\n]/g, '').trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanDestination)) {
        return Response.json({ error: 'Invalid email address' }, { status: 400 });
      }
      const users = await base44.asServiceRole.entities.User.filter({ email: cleanDestination }, '-created_date', 1);
      const isRegistered = users.length > 0;
      if (!isRegistered) {
        // Do not disclose whether an email address is registered.
        return Response.json({ success: true, method: 'email' });
      }
      // Sanitize the message body to remove CRLF sequences
      const cleanMessage = String(message)
        .replace(/[\r\n]{2,}/g, '\n\n')
        .replace(/[\r\n]/g, '\n')
        .slice(0, 5000);
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: cleanDestination,
        subject: `Message from ${name} via NaliChat`,
        body: `${name} sent you a message on NaliChat:\n\n"${cleanMessage}"\n\n---\nReply by joining NaliChat to connect directly.`,
      });
      return Response.json({ success: true, method: 'email' });
    }

    if (type === 'sms') {
      // External SMS-to-user messaging is disabled until NaliChat has a
      // verified-phone ownership flow. A self-entered profile phone number is
      // not sufficient proof that the destination belongs to an app user.
      return Response.json(
        { error: 'External SMS messaging is temporarily unavailable', needs_setup: true },
        { status: 503 },
      );
    }

    return Response.json({ error: 'Invalid type. Use "email" or "sms"' }, { status: 400 });
  } catch (error) {
    console.error('sendExternalMessage error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});