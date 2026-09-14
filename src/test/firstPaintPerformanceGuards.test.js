import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('first-paint performance guards', () => {
  it('defers third-party analytics until after the page has loaded or gone idle', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const app = fs.readFileSync('src/App.jsx', 'utf8');

    expect(html).toContain("requestIdleCallback(loadGtm");
    expect(html).toContain("addEventListener('load', schedule");
    expect(html).not.toContain("(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start'");
    expect(app).toContain("}, 3500);");
  });

  it('keeps the first-visit onboarding shell visible immediately without an initial opacity gate', () => {
    const onboarding = fs.readFileSync('src/components/onboarding/ImmersiveOnboarding.jsx', 'utf8');
    const home = fs.readFileSync('src/pages/Home.jsx', 'utf8');

    expect(onboarding).toContain('const [visible, setVisible] = useState(true);');
    expect(onboarding).toContain('<AnimatePresence initial={false}>');
    expect(onboarding).toContain('initial={false}');
    expect(home).toContain('const shouldShowVisitorIntro = authChecked && !user && !visitorIntroSeen;');
  });

  it('uses a lightweight local PWA icon instead of the legacy remote PNG', () => {
    const manifest = fs.readFileSync('public/manifest.json', 'utf8');
    expect(manifest).toContain('/nalichat-icon.svg');
    expect(manifest).not.toContain('d8bbad742_NalichatLogo.png');
  });
});
