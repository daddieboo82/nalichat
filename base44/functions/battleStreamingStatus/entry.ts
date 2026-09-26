Deno.serve(() => {
  const url = Deno.env.get('LIVEKIT_URL') || '';
  const key = Deno.env.get('LIVEKIT_API_KEY') || '';
  const secret = Deno.env.get('LIVEKIT_API_SECRET') || '';
  return Response.json({ configured: Boolean(/^wss:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url) && key && secret) });
});