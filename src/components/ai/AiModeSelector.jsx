import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Brain, LockKeyhole } from "lucide-react";
import { useAiCapabilities } from "@/hooks/useAiCapabilities";
import { cn } from "@/lib/utils";

export default function AiModeSelector({ mode, onModeChange, disabled = false }) {
  const { capabilities, isLoading, isError } = useAiCapabilities();
  const deep = capabilities.modes.deep;

  useEffect(() => {
    if (mode === "deep" && (!deep.available || !deep.entitled)) {
      onModeChange("standard");
    }
  }, [deep.available, deep.entitled, mode, onModeChange]);

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3" aria-label="AI response mode">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">AI response mode</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Deep analysis returns a concise answer, not private reasoning traces.
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-lg bg-background/70 p-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onModeChange("standard")}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
              mode === "standard" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            Standard
          </button>
          {deep.available && deep.entitled ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onModeChange("deep")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                mode === "deep" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <Brain className="h-3.5 w-3.5" aria-hidden="true" />
              Deep
            </button>
          ) : deep.available ? (
            <Link
              to="/pricing?source=ai_mode_selector&feature=ai.deep_analysis"
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
              aria-label="Unlock Premium Plus Deep analysis"
            >
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              Deep · Plus
            </Link>
          ) : (
            <span
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground/70"
              title={isError ? "AI capability status could not be verified" : undefined}
            >
              <Brain className="h-3.5 w-3.5" aria-hidden="true" />
              {isLoading ? "Checking Deep" : "Deep unavailable"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
