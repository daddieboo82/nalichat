import { getLiveKitConfig } from '../../shared/livekitConfig.ts';
Deno.serve(() => {
  const { urlValid, key, secret } = getLiveKitConfig();
  return Response.json({ configured: Boolean(urlValid && key && secret) });
});