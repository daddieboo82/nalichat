import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const users = await base44.asServiceRole.entities.User.filter({ email: "bossglop43@gmail.com" });
        if (users.length > 0) {
            await base44.asServiceRole.entities.User.update(users[0].id, { role: "admin" });
            return Response.json({ success: true, updatedUser: users[0].id });
        }
        return Response.json({ success: false, message: "User not found" });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});