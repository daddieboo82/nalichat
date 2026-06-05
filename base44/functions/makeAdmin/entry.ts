import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const users = await base44.asServiceRole.entities.User.list();
    const adminUser = users.find(u => u.email === 'bossglop43@gmail.com');
    
    return Response.json({ success: true, user: adminUser });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});