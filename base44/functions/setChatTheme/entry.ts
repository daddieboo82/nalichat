import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import {
  canSelectChatTheme,
  CHAT_THEME_ENTITLEMENT,
  getChatTheme,
  isChatThemeId,
} from '../../shared/chatThemes.ts';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'chat_theme_update',
      120,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const payload = await readJsonBodyLimited(req, 8 * 1024);
    const themeId = payload?.theme_id;
    if (!isChatThemeId(themeId)) {
      return Response.json({ error: 'Unknown chat theme.' }, { status: 400 });
    }

    const theme = getChatTheme(themeId);
    if (theme.premium) {
      const { allowed } = await requireEntitlement(
        base44.asServiceRole.entities,
        user.id,
        CHAT_THEME_ENTITLEMENT,
      );
      if (!allowed || !canSelectChatTheme(themeId, true)) {
        return Response.json(
          { error: 'Premium chat themes require an active paid plan.' },
          { status: 403 },
        );
      }
    }

    await base44.asServiceRole.entities.User.update(user.id, { chat_theme_id: themeId });
    return Response.json({ success: true, action: 'set_chat_theme', userId: user.id, theme_id: themeId });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('setChatTheme error:', error);
    return Response.json(
      { error: 'Unable to save chat theme.' },
      { status: 500 },
    );
  }
});
