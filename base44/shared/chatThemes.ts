export const CHAT_THEME_ENTITLEMENT = 'appearance.premium_themes' as const;
export const DEFAULT_CHAT_THEME_ID = 'default' as const;

export interface ChatThemeTokens {
  background: string;
  surface: string;
  surfaceRaised: string;
  foreground: string;
  muted: string;
  ownBubble: string;
  ownForeground: string;
  otherBubble: string;
  otherForeground: string;
  link: string;
  reaction: string;
  delivery: string;
  focus: string;
  border: string;
}

export interface ChatThemeDefinition {
  id: string;
  name: string;
  description: string;
  premium: boolean;
  className: string;
  tokens: ChatThemeTokens;
}

export const CHAT_THEMES = [
  {
    id: DEFAULT_CHAT_THEME_ID,
    name: 'Nali',
    description: 'The classic NaliBase dark canvas.',
    premium: false,
    className: 'chat-theme--default',
    tokens: {
      background: '#09090b',
      surface: '#141416',
      surfaceRaised: '#27272a',
      foreground: '#f4f4f5',
      muted: '#a1a1aa',
      ownBubble: '#7c3aed',
      ownForeground: '#ffffff',
      otherBubble: '#18181b',
      otherForeground: '#f4f4f5',
      link: '#c4b5fd',
      reaction: '#27272a',
      delivery: '#a1a1aa',
      focus: '#fbbf24',
      border: '#3f3f46',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Session',
    description: 'Deep navy tones with an electric cyan glow.',
    premium: true,
    className: 'chat-theme--midnight',
    tokens: {
      background: '#07111f',
      surface: '#0f2033',
      surfaceRaised: '#20435e',
      foreground: '#f8fafc',
      muted: '#b9d6e8',
      ownBubble: '#075985',
      ownForeground: '#ffffff',
      otherBubble: '#16324a',
      otherForeground: '#f8fafc',
      link: '#67e8f9',
      reaction: '#20435e',
      delivery: '#b9d6e8',
      focus: '#fbbf24',
      border: '#35617e',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Forest shadows with luminous green accents.',
    premium: true,
    className: 'chat-theme--aurora',
    tokens: {
      background: '#071611',
      surface: '#10251d',
      surfaceRaised: '#244c3e',
      foreground: '#f8fafc',
      muted: '#b7d9ca',
      ownBubble: '#166534',
      ownForeground: '#ffffff',
      otherBubble: '#183b30',
      otherForeground: '#f8fafc',
      link: '#86efac',
      reaction: '#244c3e',
      delivery: '#b7d9ca',
      focus: '#facc15',
      border: '#3a6958',
    },
  },
  {
    id: 'sunset',
    name: 'Afterglow',
    description: 'Warm plum shadows and a rose-colored horizon.',
    premium: true,
    className: 'chat-theme--sunset',
    tokens: {
      background: '#1c0d18',
      surface: '#321426',
      surfaceRaised: '#5a2942',
      foreground: '#fff7ed',
      muted: '#e8b8c9',
      ownBubble: '#9f1239',
      ownForeground: '#ffffff',
      otherBubble: '#492037',
      otherForeground: '#fff7ed',
      link: '#fda4af',
      reaction: '#5a2942',
      delivery: '#e8b8c9',
      focus: '#fbbf24',
      border: '#75405d',
    },
  },
] as const satisfies readonly ChatThemeDefinition[];

export type ChatThemeId = (typeof CHAT_THEMES)[number]['id'];

const THEME_IDS = new Set<string>(CHAT_THEMES.map((theme) => theme.id));

export function isChatThemeId(value: unknown): value is ChatThemeId {
  return typeof value === 'string' && THEME_IDS.has(value);
}

export function normalizeChatThemeId(value: unknown): ChatThemeId {
  return isChatThemeId(value) ? value : DEFAULT_CHAT_THEME_ID;
}

export function getChatTheme(value: unknown) {
  const id = normalizeChatThemeId(value);
  return CHAT_THEMES.find((theme) => theme.id === id) ?? CHAT_THEMES[0];
}

export function canSelectChatTheme(value: unknown, hasPremiumThemes: boolean): boolean {
  if (!isChatThemeId(value)) return false;
  return !getChatTheme(value).premium || hasPremiumThemes;
}

export function resolveEffectiveChatThemeId(
  storedThemeId: unknown,
  hasPremiumThemes: boolean,
): ChatThemeId {
  const normalized = normalizeChatThemeId(storedThemeId);
  return canSelectChatTheme(normalized, hasPremiumThemes)
    ? normalized
    : DEFAULT_CHAT_THEME_ID;
}
