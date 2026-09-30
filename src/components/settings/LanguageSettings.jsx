import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Globe, Loader2 } from "lucide-react";

const COMMON_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español (Spanish)" },
  { code: "pt", name: "Português (Portuguese)" },
  { code: "fr", name: "Français (French)" },
  { code: "de", name: "Deutsch (German)" },
  { code: "it", name: "Italiano (Italian)" },
  { code: "ja", name: "日本語 (Japanese)" },
  { code: "ko", name: "한국어 (Korean)" },
  { code: "zh", name: "中文 (Chinese)" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "ru", name: "Русский (Russian)" },
  { code: "nl", name: "Nederlands (Dutch)" },
  { code: "pl", name: "Polski (Polish)" },
  { code: "tr", name: "Türkçe (Turkish)" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "th", name: "ไทย (Thai)" },
  { code: "vi", name: "Tiếng Việt (Vietnamese)" },
  { code: "he", name: "עברית (Hebrew)" },
  { code: "fa", name: "فارسی (Persian)" },
  { code: "sv", name: "Svenska (Swedish)" },
  { code: "el", name: "Ελληνικά (Greek)" },
  { code: "cs", name: "Čeština (Czech)" },
  { code: "uk", name: "Українська (Ukrainian)" },
];

export default function LanguageSettings() {
  const { language, setLanguage, translating } = useLanguage();

  const currentInList = COMMON_LANGUAGES.some((l) => l.code === language);
  const languages = currentInList
    ? COMMON_LANGUAGES
    : [{ code: language, name: language.toUpperCase() }, ...COMMON_LANGUAGES];

  return (
    <div
      data-no-translate
      className="ui-surface flex flex-col gap-4 rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6"
    >
      <div className="flex-1">
        <label className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
          Language
        </label>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose your language — the app interface translates automatically.
          {translating && (
            <span className="ml-1 inline-flex items-center gap-1 text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              Translating…
            </span>
          )}
        </p>
      </div>
      <div className="w-full sm:w-64">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="h-12 rounded-xl border border-border/50 bg-secondary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent data-no-translate>
            {languages.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}