import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";

describe("NALI.ai discovery hints isolate accounts on a shared browser", () => {
  it("uses signed-in account ID to scope the idle assistant hint", async () => {
    const hint = await fs.readFile("src/components/AskNaliHint.jsx", "utf8");
    expect(hint).toContain("const { user } = useAuth()");
    expect(hint).toContain('nali_hint_dismissed:${user?.id || "anonymous"}');
    expect(hint).toContain("sessionGet(dismissalKey)");
    expect(hint).toContain('sessionSet(dismissalKey, "1")');
    expect(hint).toContain("canUseAi = hasEntitlement");
    expect(hint).toContain("canUseAi, dismissalKey");
  });

  it("scopes contextual hint dismissals to each user and surface", async () => {
    const hint = await fs.readFile("src/components/nali/NaliContextHint.jsx", "utf8");
    expect(hint).toContain('nali_hint_dismissed_${surface}:${userId || "anonymous"}');
    expect(hint).toContain("DISMISS_KEY(surface, userId)");
    expect(hint).toContain("delayMs, userId");
    expect(hint).toContain("!canUseAi");
  });
});