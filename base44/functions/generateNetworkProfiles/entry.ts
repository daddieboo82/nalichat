import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const prompt = `Generate 15 realistic music industry profiles (5 artists, 4 producers, 3 engineers, 3 A&Rs). Return ONLY valid JSON array with no markdown formatting.

Each profile must have:
- full_name: realistic name
- display_name: stage/professional name
- role: one of "artist", "producer", "engineer", "ar"
- bio: 1-2 sentence professional bio (max 150 chars)
- location: real city, country
- genres: array of 2-3 music genres
- avatar_url: a valid unsplash profile photo URL (https://images.unsplash.com/...)

Ensure variety in locations and genres. Return as pure JSON array, nothing else.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          profiles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                full_name: { type: 'string' },
                display_name: { type: 'string' },
                role: { type: 'string' },
                bio: { type: 'string' },
                location: { type: 'string' },
                genres: { type: 'array', items: { type: 'string' } },
                avatar_url: { type: 'string' }
              }
            }
          }
        }
      }
    });

    const profiles = response.profiles || [];
    const created = [];

    for (const profile of profiles) {
      const newUser = await base44.asServiceRole.entities.User.create({
        full_name: profile.full_name,
        display_name: profile.display_name,
        role: profile.role,
        bio: profile.bio,
        location: profile.location,
        genres: profile.genres,
        avatar_url: profile.avatar_url,
        email: `${profile.display_name.replace(/\s+/g, '').toLowerCase()}@studio.local`,
        cover_url: profile.avatar_url,
        website: '',
        artist_role: profile.role,
        badge: ''
      });
      created.push(newUser);
    }

    return Response.json({ 
      success: true, 
      created: created.length,
      profiles: created 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});