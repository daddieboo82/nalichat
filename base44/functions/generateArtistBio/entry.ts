import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a bio ONLY for the requesting user — never bulk-fill other users.
    const prompt = `Generate a professional, engaging 2-3 sentence bio for a music industry professional with the following profile:
Name: ${user.display_name || user.full_name}
Role: ${user.artist_role || user.role || 'Music Professional'}
Location: ${user.location || 'Not specified'}
Genres: ${user.genres?.join(', ') || 'Not specified'}
Website: ${user.website || 'Not specified'}

The bio should be written in first person, highlight their expertise, and sound authentic and inspiring. Keep it concise and suitable for a professional music network profile. Return only the bio text.`;

    const bioResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: "claude_opus_4_8",
      prompt: prompt,
    });

    const bio = bioResponse.trim();

    return Response.json({ bio });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});