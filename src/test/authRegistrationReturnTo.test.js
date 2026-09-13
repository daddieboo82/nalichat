import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('auth registration return-to handoff', () => {
  it('preserves the intended destination across login/register switches and pricing signup', async () => {
    const login = await readFile('src/pages/Login.jsx', 'utf8');
    const register = await readFile('src/pages/Register.jsx', 'utf8');
    const pricing = await readFile('src/components/pricing/PricingPlans.jsx', 'utf8');
    expect(login).toContain('/register?returnTo=');
    expect(login).toContain('encodeURIComponent(safeReturnTo())');
    expect(register).toContain('/login?returnTo=');
    expect(register).toContain('encodeURIComponent(safeReturnTo())');
    expect(pricing).toContain('navigate(`/register?returnTo=${encodeURIComponent("/pricing")}`)');
    expect(pricing).not.toContain('navigate("/register", { state: { from: "/pricing" } })');
  });
});
