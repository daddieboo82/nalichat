import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Sends a collaborator invite email on behalf of the logged-in user.
// Moved to a backend function to protect the SendEmail integration from
// direct client access.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, inviteLink } = await req.json();
    if (!to || !to.trim()) {
      return Response.json({ error: 'Recipient email is required' }, { status: 400 });
    }
    if (!inviteLink) {
      return Response.json({ error: 'Invite link is required' }, { status: 400 });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: to.trim(),
      subject: 'Join me on NaliChat',
      body: `Hey! I'd love to collaborate with you on NaliChat. Join me here: ${inviteLink}`,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('send-invite-email error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});