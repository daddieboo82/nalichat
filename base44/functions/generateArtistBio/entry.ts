import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all users without bios
    const allUsers = await base44.asServiceRole.entities.User.list('', 500);
    const usersNeedingBios = allUsers.filter(u => !u.bio || u.bio.trim().length === 0);

    if (usersNeedingBios.length === 0) {
      return Response.json({ message: 'No users need bios', generated: 0 });
    }

    const generated = [];

    // Generate bios for up to 10 users at a time
    for (const artist of usersNeedingBios.slice(0, 10)) {
      try {
        const prompt = `Generate a professional, engaging 2-3 sentence bio for a music industry professional with the following profile:
Name: ${artist.full_name}
Role: ${artist.role || 'Music Professional'}
Location: ${artist.location || 'Not specified'}
Genres: ${artist.genres?.join(', ') || 'Not specified'}
Website: ${artist.website || 'Not specified'}

The bio should be written in first person, highlight their expertise, and sound authentic and inspiring. Keep it concise and suitable for a professional music network profile.`;

        const bioResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: prompt,
        });

        const bio = bioResponse.trim();

        // Update user with the generated bio
        await base44.asServiceRole.entities.User.update(artist.id, { bio });

        generated.push({
          id: artist.id,
          name: artist.full_name,
          bio: bio,
        });
      } catch (error) {
        console.error(`Failed to generate bio for ${artist.full_name}:`, error.message);
      }
    }

    return Response.json({
      message: `Generated ${generated.length} bios`,
      generated,
      remaining: usersNeedingBios.length - generated.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});