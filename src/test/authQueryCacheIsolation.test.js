import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("auth query-cache isolation", () => {
  it("clears React Query state on account replacement, auth loss, and logout", async () => {
    const source = await readFile(
      new URL("../../src/lib/AuthContext.jsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("const queryClient = useQueryClient();");
    expect(source).toContain("const lastUserIdRef = useRef(null);");
    expect(source).toContain("previousUserId && previousUserId !== currentUser?.id");
    expect(source).toContain("queryClient.clear();");
    expect(source).toContain("lastUserIdRef.current = currentUser?.id || null;");
    expect(source).toContain("const departingUserId = lastUserIdRef.current;");
    expect(source).toContain("if (departingUserId) queryClient.clear();");
    expect(source).toContain("lastUserIdRef.current = null;");
  });
});
