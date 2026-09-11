import { publicPushConfig } from '../../shared/webPush.ts';

Deno.serve(() => Response.json(publicPushConfig()));
