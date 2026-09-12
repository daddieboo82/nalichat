// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('registration storage resilience', () => {
  it('does not let sessionStorage failures block OTP or Google registration flows', async () => {
    const source = await readText('src/pages/Register.jsx');

    expect(source).toContain('try { sessionStorage.setItem("is_new_user", "true"); } catch {}');
    expect(source).not.toContain('\n      sessionStorage.setItem("is_new_user", "true");\n      window.location.href');
    expect(source).not.toContain('\n    sessionStorage.setItem("is_new_user", "true");\n    base44.auth.loginWithProvider');
  });
});
