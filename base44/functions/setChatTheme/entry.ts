import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  canSelectChatTheme,
  CHAT_THEME_ENTITLEMENT,
  getChatTheme,
  isChatThemeId,
} from '../../shared/chatThemes.ts';
import { resolveUserSubscription } from '../../shared/subscriptionAccess.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const themeId = payload?.theme_id;
    if (!isChatThemeId(themeId)) {
      return Response.json({ error: 'Unknown chat theme.' }, { status: 400 });
    }

    const theme = getChatTheme(themeId);
    if (theme.premium) {
      const access = await resolveUserSubscription(
        base44.asServiceRole.entities.Subscription,
        user.id,
      );
      if (
        access.entitlements[CHAT_THEME_ENTITLEMENT] !== true
        || !canSelectChatTheme(themeId, true)
      ) {
        return Response.json(
          { error: 'Premium chat themes require an active paid plan.' },
          { status: 403 },
        );
      }
    }

    await base44.asServiceRole.entities.User.update(user.id, {
      chat_theme_id: themeId,
    });

    return Response.json({ theme_id: themeId });
  } catch (error) {
    console.error('setChatTheme error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to save chat theme.' },
      { status: 500 },
    );
  }
});
