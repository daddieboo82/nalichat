import { useEffect, useState } from "react";
import { Check, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import {
  CHAT_THEME_ENTITLEMENT,
  CHAT_THEMES,
  getChatTheme,
  normalizeChatThemeId,
  persistChatThemePreference,
  resolveEffectiveChatThemeId,
} from "@/lib/chatThemes";
import InlineEntitlementPrompt from "@/components/subscription/InlineEntitlementPrompt";

export default function ChatThemeSettings({ user, onPreferenceSaved }) {
  const { hasEntitlement, isLoading, isError } = useSubscription();
  const hasPremiumThemes = !isLoading
    && !isError
    && hasEntitlement?.(CHAT_THEME_ENTITLEMENT) === true;
  const [selectedThemeId, setSelectedThemeId] = useState(
    normalizeChatThemeId(user?.chat_theme_id),
  );
  const [savingThemeId, setSavingThemeId] = useState(null);
  const [showPrompt, setShowPrompt] = useState(!hasPremiumThemes);
  const effectiveThemeId = resolveEffectiveChatThemeId(
    selectedThemeId,
    hasPremiumThemes,
  );

  useEffect(() => {
    setSelectedThemeId(normalizeChatThemeId(user?.chat_theme_id));
  }, [user?.chat_theme_id]);

  const selectTheme = async (theme) => {
    if (theme.premium && !hasPremiumThemes) {
      setShowPrompt(true);
      return;
    }
    if (theme.id === selectedThemeId || savingThemeId) return;

    setSavingThemeId(theme.id);
    try {
      const savedThemeId = await persistChatThemePreference(theme.id);
      setSelectedThemeId(savedThemeId);
      await onPreferenceSaved?.(savedThemeId);
      toast.success(`${getChatTheme(savedThemeId).name} chat theme saved.`);
    } catch (error) {
      toast.error(error?.message || "Couldn't save your chat theme. Please try again.");
    } finally {
      setSavingThemeId(null);
    }
  };

  const moveSelection = (event) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const options = [...event.currentTarget.parentElement.querySelectorAll('[role="radio"]')];
    const currentIndex = options.indexOf(event.currentTarget);
    const enabledOptions = options.filter((option) => option.getAttribute("aria-disabled") !== "true");
    if (!enabledOptions.length) return;

    let nextOption;
    if (event.key === "Home") nextOption = enabledOptions[0];
    else if (event.key === "End") nextOption = enabledOptions.at(-1);
    else {
      const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      for (let offset = 1; offset <= options.length; offset += 1) {
        const candidate = options[
          (currentIndex + direction * offset + options.length) % options.length
        ];
        if (candidate.getAttribute("aria-disabled") !== "true") {
          nextOption = candidate;
          break;
        }
      }
    }
    nextOption?.focus();
    nextOption?.click();
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-heading text-lg font-semibold">Chat appearance</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your choice follows you across conversations and is visible only to you.
        </p>
        {selectedThemeId !== effectiveThemeId && (
          <p className="mt-2 text-sm text-amber-300" role="status">
            Your saved Premium theme is preserved. Nali is shown until paid access returns.
          </p>
        )}
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Chat theme"
        aria-busy={savingThemeId !== null}
      >
        {CHAT_THEMES.map((theme) => {
          const selected = selectedThemeId === theme.id;
          const locked = theme.premium && !hasPremiumThemes;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={locked || savingThemeId !== null}
              tabIndex={selected ? 0 : -1}
              onKeyDown={moveSelection}
              onClick={() => selectTheme(theme)}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected ? "border-primary bg-primary/5" : "border-border bg-card/40 hover:border-primary/50",
              )}
            >
              <div
                className={cn(
                  "chat-theme chat-theme-preview relative mb-3 h-24 overflow-hidden rounded-xl border",
                  theme.className,
                )}
                aria-hidden="true"
              >
                <div className="chat-theme-preview-header" />
                <div className="chat-theme-preview-bubble chat-theme-preview-bubble--other" />
                <div className="chat-theme-preview-bubble chat-theme-preview-bubble--own" />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-semibold text-foreground">{theme.name}</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">{theme.description}</p>
                </div>
                <span className="mt-0.5 text-primary">
                  {savingThemeId === theme.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" />
                  ) : locked ? (
                    <LockKeyhole className="h-4 w-4" aria-label="Premium" />
                  ) : selected ? (
                    <Check className="h-4 w-4" aria-label="Selected" />
                  ) : null}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {!isLoading && !hasPremiumThemes && showPrompt && (
        <InlineEntitlementPrompt
          entitlement={CHAT_THEME_ENTITLEMENT}
          source="settings_chat_themes"
          title="Unlock Premium chat themes"
          description={isError
            ? "We couldn't verify your subscription. Premium themes stay locked until verification succeeds."
            : "Premium and Premium Plus include every curated chat theme."}
        />
      )}
    </div>
  );
}
