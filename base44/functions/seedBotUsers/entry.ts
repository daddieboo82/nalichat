import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const botCount = 20;
    const invitedUsers = [];
    const errors = [];

    for (let i = 1; i <= botCount; i++) {
      try {
        const email = `bot${i}@nalichat.local`;
        await base44.users.inviteUser(email, "user");
        invitedUsers.push(email);
        console.log(`[✓] Invited bot user ${i}: ${email}`);
      } catch (err) {
        const errorMsg = `Bot ${i} failed: ${err.message}`;
        errors.push(errorMsg);
        console.log(`[✗] ${errorMsg}`);
      }
    }

    return Response.json({
      success: true,
      invited: invitedUsers.length,
      total: botCount,
      invitedUsers,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (error) {
    console.error('Seed error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});