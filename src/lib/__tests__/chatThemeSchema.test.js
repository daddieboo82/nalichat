import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAT_THEMES } from "../../../base44/shared/chatThemes.ts";

describe("chat theme user preference schema", () => {
  it("declares every catalog ID and blocks direct self-writes", () => {
    const schema = JSON.parse(readFileSync(
      new URL("../../../base44/entities/User.jsonc", import.meta.url),
      "utf8",
    ));
    const field = schema.properties.chat_theme_id;

    expect(field.type).toBe("string");
    expect(field.default).toBe("default");
    expect(field.enum).toEqual(CHAT_THEMES.map((theme) => theme.id));
    expect(field.rls.read).toBe(true);
    expect(field.rls.write).toEqual({
      user_condition: { role: "admin" },
    });
  });
});
