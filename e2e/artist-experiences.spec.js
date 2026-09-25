import { expect, test } from '@playwright/test';
const email=process.env.E2E_USER_EMAIL, password=process.env.E2E_USER_PASSWORD;
const routes=[
 ['/artist-career-os','One command center for the entire artist journey.'], ['/artist-release-center','Artist Release Center'],
 ['/artist-creative-director','AI Creative Director'], ['/collaboration-rooms','Collaboration Rooms'],
 ['/artist-marketplace','Artist Marketplace'], ['/artist-backstage','Backstage'], ['/release-war-room','Release War Room'],
 ['/song-feedback-lab','Song Feedback Lab'], ['/live-studio-sessions','Live Studio Sessions'], ['/artist-world','Artist World']
];
async function login(page){
 await page.goto('/login',{waitUntil:'domcontentloaded'}); await page.locator('#email').fill(email); await page.locator('#password').fill(password);
 await page.getByRole('button',{name:/^log in$/i}).click();
 await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({timeout:30000});
 await expect(page.getByText('Loading app...',{exact:true})).toBeHidden({timeout:30000}); await page.waitForTimeout(750);
}
test.describe('artist experiences',()=>{
 test.skip(!(email&&password),'E2E credentials required.');
 test.beforeEach(async({page})=>login(page));
 for(const [route,heading] of routes)test(`${route} renders`,async({page})=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(route,{waitUntil:'domcontentloaded'});await expect.poll(()=>new URL(page.url()).pathname,{timeout:30000}).toBe(route);await expect(page.getByText(heading,{exact:false}).first()).toBeVisible({timeout:30000});expect(errors).toEqual([]);});
});
