// Missing-item sidebar UI QA: node tests/browser-smoke.mjs /path/to/playwright/index.mjs
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
 const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{if(!route.request().url().startsWith(origin)){external.push(route.request().url());return route.abort();}return route.continue();});
 await page.goto(origin);
 await page.waitForFunction(()=>document.querySelector('#catalogStatus').textContent.includes('Dane R21 gotowe'));
 await page.locator('#editInventoryFromGoal').click();
 await page.locator('#inventoryText').fill('Bojowa Czapka Gladiatora (+1)');
 await page.locator('#inventoryForm button[type=submit]').click();
 await page.locator('#missingTab').click();
 await page.locator('#goalCategory').selectOption('head');
 await page.locator('#goalPrefix').selectOption('smiercionosny');
 await page.locator('#goalSuffix').selectOption('prekognicji');
 await page.locator('#goalSteps').selectOption('1');
 await page.locator('#goalSearch').click();
 await page.locator('#goalMissingList').waitFor();
 const initial=await page.locator('#goalMissingList').inputValue();
 assert.ok(initial.split('\n').length>100,'List includes more than one page of ingredients');
 assert.equal(await page.locator('#goalPlanList details').count(),100);
 assert.ok(initial.split('\n').every(line=>/^[12] - .+/.test(line)));
 assert.equal(new Set(initial.split('\n').map(line=>line.slice(4))).size,initial.split('\n').length);
 const sidebarBox=await page.locator('.goalMissingSidebar').boundingBox();
 const plansBox=await page.locator('#goalPlanList').boundingBox();
 assert.ok(sidebarBox.x>plansBox.x+plansBox.width,'Desktop sidebar is beside recipes');
 await page.locator('#goalShowMore').click();
 assert.equal(await page.locator('#goalMissingList').inputValue(),initial,'Pagination does not change the list');
 await page.locator('#goalStepsFilter').selectOption('1');
 await page.locator('#goalMissingFilter').selectOption('2');
 assert.ok((await page.locator('#goalPlanList summary').allTextContents()).every(text=>text.startsWith('1 spaw · brakuje 2:')));
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 await page.locator('#goalCopyList').click();
 await page.waitForFunction(()=>document.querySelector('#goalCopyStatus').textContent==='Skopiowano listę.');
 assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n'),await page.locator('#goalMissingList').inputValue());
 await page.locator('#goalTextFilter').fill('nieistniejacy item');
 assert.equal(await page.locator('#goalMissingList').inputValue(),'');
 assert.equal(await page.locator('#goalCopyList').isDisabled(),true);
 await page.locator('#goalTextFilter').fill('');
 await page.setViewportSize({width:375,height:800});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 const mobileSidebar=await page.locator('.goalMissingSidebar').boundingBox();
 const mobilePlans=await page.locator('#goalPlanList').boundingBox();
 assert.ok(mobileSidebar.y+mobileSidebar.height<=mobilePlans.y,'Mobile list is above recipes');
 await page.locator('#goalSteps').selectOption('2');
 assert.equal(await page.locator('#goalMissingList').count(),0,'New target clears the old list');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('Missing list browser QA passed: all results, quantities, filters, copy, pagination, desktop/mobile layout and reset.');
}finally{await browser.close();server.close();}
