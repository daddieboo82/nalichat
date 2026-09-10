import { describe, expect, it } from "vitest";
import {
  canSelectChatTheme,
  CHAT_THEMES,
  DEFAULT_CHAT_THEME_ID,
  getChatTheme,
  isChatThemeId,
  normalizeChatThemeId,
  resolveEffectiveChatThemeId,
} from "../../../base44/shared/chatThemes.ts";

function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    ));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe("chat theme catalog", () => {
  it("contains one Free default and unique, CSS-safe catalog entries", () => {
    expect(CHAT_THEMES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(CHAT_THEMES.map((theme) => theme.id)).size).toBe(CHAT_THEMES.length);

    const defaultTheme = getChatTheme(DEFAULT_CHAT_THEME_ID);
    expect(defaultTheme.premium).toBe(false);
    expect(CHAT_THEMES.filter((theme) => !theme.premium)).toEqual([defaultTheme]);

    for (const theme of CHAT_THEMES) {
      expect(theme.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(theme.className).toBe(`chat-theme--${theme.id}`);
      expect(Object.values(theme.tokens).every(
        (color) => /^#[0-9a-f]{6}$/i.test(color),
      )).toBe(true);
    }
  });

  it("keeps message text, links, reactions, and delivery states readable", () => {
    for (const theme of CHAT_THEMES) {
      const { tokens } = theme;
      expect(contrastRatio(tokens.foreground, tokens.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.ownForeground, tokens.ownBubble)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.otherForeground, tokens.otherBubble)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.link, tokens.otherBubble)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.foreground, tokens.reaction)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.delivery, tokens.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.focus, tokens.background)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("chat theme selection", () => {
  it("normalizes missing and unknown preference values to the Free default", () => {
    expect(normalizeChatThemeId(null)).toBe(DEFAULT_CHAT_THEME_ID);
    expect(normalizeChatThemeId("not-a-theme")).toBe(DEFAULT_CHAT_THEME_ID);
    expect(getChatTheme("<style>bad</style>").id).toBe(DEFAULT_CHAT_THEME_ID);
    expect(isChatThemeId("midnight")).toBe(true);
    expect(isChatThemeId("not-a-theme")).toBe(false);
  });

  it("requires the canonical entitlement for premium selections", () => {
    expect(canSelectChatTheme(DEFAULT_CHAT_THEME_ID, false)).toBe(true);
    expect(canSelectChatTheme("midnight", false)).toBe(false);
    expect(canSelectChatTheme("midnight", true)).toBe(true);
    expect(canSelectChatTheme("not-a-theme", true)).toBe(false);
  });

  it("falls back on downgrade without deleting the stored choice and restores it later", () => {
    const storedThemeId = "aurora";
    expect(resolveEffectiveChatThemeId(storedThemeId, true)).toBe("aurora");
    expect(resolveEffectiveChatThemeId(storedThemeId, false)).toBe(DEFAULT_CHAT_THEME_ID);
    expect(resolveEffectiveChatThemeId(storedThemeId, true)).toBe("aurora");
  });
});
