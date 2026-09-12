import { chromium } from '@playwright/test';
import fs from 'fs';
fs.rmSync('/tmp/studio-videos',{recursive:true,force:true}); fs.mkdirSync('/tmp/studio-videos',{recursive:true});
const browser=await chromium.launch({headless:true});
async function setup(name){
 const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:'/tmp/studio-videos',size:{width:1280,height:720}}});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:4173/studio-capture',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/Load Demo Project/i}).click();
 await page.waitForTimeout(1800);
 return {context,page,name};
}
async function finish(o){ const v=o.page.video(); await o.context.close(); const p=await v.path(); const out=`/tmp/studio-videos/${o.name}.webm`; fs.renameSync(p,out); console.log(out); }

let o=await setup('01-session-playback');
await o.page.getByRole('button',{name:/Play\/Pause/i}).click();
await o.page.waitForTimeout(5200);
await o.page.getByRole('button',{name:/Play\/Pause/i}).click();
await o.page.waitForTimeout(900);
await finish(o);

o=await setup('02-mixer-fx');
await o.page.getByRole('button',{name:/Mixer/i}).last().click();
await o.page.waitForTimeout(900);
const vol=o.page.getByRole('slider',{name:/Volume for Demo Lead/i});
if(await vol.count()){ await vol.focus(); await vol.press('ArrowUp'); await vol.press('ArrowUp'); await vol.press('ArrowUp'); }
await o.page.getByRole('button',{name:/Play\/Pause/i}).click();
await o.page.waitForTimeout(3500);
const fx=o.page.getByRole('button',{name:/FX/i}).first();
if(await fx.count()) { await fx.click(); await o.page.waitForTimeout(2200); }
await finish(o);

o=await setup('03-export-workflow');
await o.page.getByRole('button',{name:'Export',exact:true}).click();
await o.page.waitForTimeout(1200);
const wav=o.page.getByText(/Download Mix \(WAV\)/i).first();
if(await wav.count()){ await wav.hover(); await o.page.waitForTimeout(1200); await wav.click(); await o.page.waitForTimeout(2600); }
await finish(o);

await browser.close();
