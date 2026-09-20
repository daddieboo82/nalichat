import { expect, test } from '@playwright/test';
const email=process.env.E2E_USER_EMAIL, password=process.env.E2E_USER_PASSWORD;
async function login(page){
 await page.goto('/login'); await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.getByRole('button',{name:/^log in$/i}).click();
 await page.waitForURL(u=>new URL(u).pathname!='/login',{timeout:30000}); await page.locator('[data-testid="auth-state"][data-state="authenticated"]').waitFor({state:'attached',timeout:30000});
}
test.describe('Studio visual integrity',()=>{
 test.skip(!(email&&password),'requires E2E credentials');
 test('demo editor fits viewport and core controls render',async({page})=>{
  const errors=[]; page.on('pageerror',e=>errors.push(String(e))); page.on('console',m=>{if(m.type()==='error') errors.push(m.text())});
  await login(page); await page.goto('/studio'); await expect.poll(()=>new URL(page.url()).pathname,{timeout:30000}).toBe('/studio');
  const welcome=page.getByRole('heading',{name:/welcome to studio/i}); await expect(welcome).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:/load demo project/i}).click(); await expect(welcome).toBeHidden({timeout:30000});
  await expect(page.getByRole('button',{name:/play\/pause/i})).toBeVisible(); await expect(page.getByRole('button',{name:/record/i})).toBeVisible();
  const clip=page.locator('[data-testid^="studio-audio-clip-"]').first(); await expect(clip).toBeVisible({timeout:30000});
  const vp=page.viewportSize(); const body=await page.locator('body').evaluate(el=>({sw:el.scrollWidth,sh:el.scrollHeight,cw:el.clientWidth,ch:el.clientHeight}));
  expect(body.sw).toBeLessThanOrEqual(vp.width+2); expect(body.sh).toBeLessThanOrEqual(vp.height+2);
  const box=await clip.boundingBox(); expect(box.x+box.width).toBeGreaterThan(0); expect(box.y+box.height).toBeGreaterThan(0);
  expect(errors.filter(x=>!/favicon|Failed to load resource.*(?:401|404)|Public settings check failed:.*404/is.test(x))).toEqual([]);
 });
});

