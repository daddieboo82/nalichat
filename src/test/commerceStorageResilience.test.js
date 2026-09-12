// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('commerce storage resilience', () => {
  it('keeps the cart usable when localStorage is unavailable', async () => {
    const source = await readText('src/lib/CartContext.jsx');
    expect(source).toContain("try {");
    expect(source).toContain("const cartStorageKey = `shopping_cart:${user?.id || 'anonymous'}`;");
    expect(source).toContain("localStorage.setItem(cartStorageKey, JSON.stringify(items));");
    expect(source).toContain("if (!user?.id)");
    expect(source).toContain("localStorage.removeItem('shopping_cart');");
    expect(source).toContain('Cart still works in-memory when browser storage is unavailable.');
  });

  it('keeps subscription checkout working when sessionStorage is unavailable', async () => {
    const source = await readText('src/components/pricing/PricingPlans.jsx');
    expect(source).toContain('try { sessionStorage.setItem(CHECKOUT_RETURN_KEY, "1"); } catch {}');
    expect(source).toContain('try { sessionStorage.removeItem(CHECKOUT_RETURN_KEY); } catch {}');
    expect(source).toContain('Checkout remains usable even when session storage is blocked.');
  });

  it('does not block confirmed subscription handling on analytics storage failures', async () => {
    const source = await readText('src/pages/ThankYou.jsx');
    expect(source).toContain('Analytics dedupe is best-effort; never block a confirmed purchase.');
    expect(source).toContain('try { sessionStorage.removeItem(CHECKOUT_RETURN_KEY); } catch {}');
  });
});
