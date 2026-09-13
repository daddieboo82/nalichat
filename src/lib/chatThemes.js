import { base44 } from "@/api/base44Client";
import {
  canSelectChatTheme,
  CHAT_THEME_ENTITLEMENT,
  CHAT_THEMES,
  DEFAULT_CHAT_THEME_ID,
  getChatTheme,
  isChatThemeId,
  normalizeChatThemeId,
  resolveEffectiveChatThemeId,
} from "../../base44/shared/chatThemes";

export {
  canSelectChatTheme,
  CHAT_THEME_ENTITLEMENT,
  CHAT_THEMES,
  DEFAULT_CHAT_THEME_ID,
  getChatTheme,
  isChatThemeId,
  normalizeChatThemeId,
  resolveEffectiveChatThemeId,
};

export async function persistChatThemePreference(themeId) {
  if (!isChatThemeId(themeId)) {
    throw new Error("Unknown chat theme.");
  }

  const response = await base44.functions.invoke("setChatTheme", {
    theme_id: themeId,
  });
  const payload = response?.data ?? response;
  if (!payload || payload.error || payload.success !== true || !isChatThemeId(payload.theme_id) || payload.theme_id !== themeId) {
    throw new Error(payload?.error || "Unable to save chat theme.");
  }
  return payload.theme_id;
}
