// Optional UI QA: node tests/browser-smoke.mjs /path/to/playwright/index.mjs
// Uses an installed browser; Playwright is not a runtime/project dependency.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const root=fileURLToPath(new URL('../',import.meta.url));
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'}[path.extname(file)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':mime+'; charset=utf-8'});fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);
 await page.waitForFunction(()=>document.querySelector('#catalogStatus').textContent.includes('Dane R21 gotowe'));
 await page.locator('#tiersTab').click();
 assert.ok(await page.locator('#tiersPanel').isVisible());
 assert.match(await page.locator('#tierPairs').textContent(),/Wklej ekwipunek/);
 await page.locator('#tiersTab').press('Home');
 assert.ok(await page.locator('#missingPanel').isVisible());
 await page.locator('#missingTab').press('End');
 assert.ok(await page.locator('#tiersPanel').isVisible());
 await page.locator('#editInventory').click();
 const raw='Utwardzana Czapka Podróżnika (+1)\nWzmocniona Czapka Przezorności (+1)\nPomocna Czapka Ochrony (+1)\nMagnum (+1)\nMagnum (+1)';
 await page.locator('#inventoryText').fill(raw);
 await page.locator('#inventoryForm button[type=submit]').click();
 await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 assert.ok(await page.locator('.tierPair').count()>0);
 assert.match(await page.locator('.tierPair').first().textContent(),/1 spaw/);
 assert.match(await page.locator('.tierPair').first().textContent(),/Prefiks:/);
 assert.match(await page.locator('#tierShelf').textContent(),/Brak obsługiwanej pary/);
 await page.locator('#craftingTab').click();
 await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 assert.ok(await page.locator('#resultsList .result').count()>0);
 await page.locator('#tiersTab').click();
 for(const kind of ['gain','mixed','neutral','loss']){
  await page.locator('#tierKind').selectOption(kind);
  assert.equal(await page.locator('.tierPair:not(.'+kind+')').count(),0);
 }
 await page.locator('#tierKind').selectOption('all');
 await page.locator('#tierCategory').selectOption('gun1');
 assert.equal(await page.locator('.tierPair').count(),0);
 await page.locator('#tierCategory').selectOption('all');
 await page.locator('#editInventory').click();
 assert.equal(await page.locator('#inventoryText').inputValue(),raw);
 await page.locator('#inventoryText').fill(Array(68).fill('Utwardzana Czapka Podróżnika (+1)').join('\n'));
 await page.locator('#inventoryForm button[type=submit]').click();
 await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 assert.match(await page.locator('#tierSummary').textContent(),/2278 dozwolonych par/);
 assert.equal(await page.locator('#loadingState').isVisible(),false);
 assert.equal(await page.locator('.tierPair').count(),50);
 await page.locator('#tierMore').click();
 assert.equal(await page.locator('.tierPair').count(),100);
 for(const width of [320,375,768,1440]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
 }
 assert.deepEqual(errors,[]);
 console.log('Tier browser QA passed: import, keyboard tabs, filters, 68 items / 2278 pairs, pagination, 320–1440 px.');
}finally{await browser.close();server.close();}
