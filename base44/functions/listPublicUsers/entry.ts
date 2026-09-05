import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Service role bypasses built-in User RLS so non-admins can discover other users.
    const allUsers = await base44.asServiceRole.entities.User.list();

    // Return only public fields needed for discovery and chat display.
    const publicUsers = allUsers.map(u => ({
      id: u.id,
      display_name: u.display_name,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      role: u.role,
      location: u.location,
      genres: u.genres || [],
      is_online: u.is_online || false,
      created_date: u.created_date,
    }));

    return Response.json({ users: publicUsers });
  } catch (error) {
    console.error('listPublicUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}