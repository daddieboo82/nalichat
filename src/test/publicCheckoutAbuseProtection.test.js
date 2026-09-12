import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("public checkout abuse protection", () => {
  it("bounds and rate-limits checkout before Stripe work", async () => {
    const source = await readText("base44/functions/createCheckout/entry.ts");

    expect(source).toContain("readJsonBodyLimited(req, 32 * 1024)");
    expect(source).toContain("anonymousCheckoutScope(req)");
    expect(source).toContain("const checkoutLimit = user?.id ? 60 : 20;");
    expect(source).toContain("'checkout_create'");
    expect(source).toContain("requestBodyErrorResponse(error)");

    expect(source.indexOf("checkoutRate.allowed")).toBeLessThan(
      source.indexOf("stripeRequest('/checkout/sessions'"),
    );
    expect(source).not.toContain("await req.json()");
  });
});
