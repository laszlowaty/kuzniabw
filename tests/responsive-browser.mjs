import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
// Run with an external Playwright installation; no application dependency.
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const root=fileURLToPath(new URL('../',import.meta.url));
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'}[path.extname(file)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':mime+'; charset=utf-8'});fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>document.querySelector('#catalogStatus').textContent.includes('Dane R21 gotowe'));
 async function fits(label){
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&!e.closest('.tableScroll');}).slice(0,8).map(e=>e.id||e.className||e.tagName)}));
  assert.ok(overflow.scroll<=overflow.width,`${label}: ${JSON.stringify(overflow)}`);
 }
 for(const width of [320,375,430,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  await page.locator('#missingTab').click();await fits(`missing ${width}`);
  await page.locator('#craftingTab').click();await fits(`crafting ${width}`);
  await page.locator('#tablesTab').click();await fits(`tables ${width}`);
  await page.locator('#forgeTab').click();
 }
 await page.setViewportSize({width:375,height:812});
 await page.locator('#missingTab').click();
 await page.locator('#editInventoryFromGoal').click();
 await page.locator('#inventoryText').fill('Kusza Doskonałości (+1)\nKusza Doskonałości (+1)\nKusza Doskonałości (+1)');
 await fits('mobile import');
 await page.locator('#inventoryForm button[type=submit]').click();
 await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 await page.locator('#craftingTab').click();
 await page.locator('#resultsList .result').first().click();
 await page.locator('#showRecipe').click();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'recipePanel');
 assert.equal(await page.locator('#step-mana-0').inputValue(),'216');
 await fits('mobile recipe');
 await page.locator('#backToResults').click();
 assert.equal(await page.locator('#resultsList .selected').evaluate(e=>document.activeElement===e),true);
 await page.keyboard.press('Escape');
 await page.locator('#inventoryList .itemInfoTrigger').first().scrollIntoViewIfNeeded();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.locator('#inventoryList .itemInfoTrigger').first().tap();
 assert.equal(await page.locator('#itemInfo').isVisible(),true);await fits('mobile item details');
 await page.keyboard.press('Escape');
 await page.keyboard.press('Tab');
 assert.equal(await page.locator('#itemInfo').isVisible(),true,'Keyboard focus opens item details');
 await page.keyboard.press('Escape');
 await page.locator('.profileDisclosure>summary').click();
 await page.locator('#profileRace').selectOption('ssak');
 await page.locator('#profileTattoo').selectOption('mnich');
 await fits('mobile profile');
 await page.locator('.profileDisclosure>summary').click();
 await page.locator('#missingTab').click();
 await page.locator('#goalCategory').selectOption('head');
 await page.locator('#goalPrefix').selectOption('smiercionosny');
 await page.locator('#goalSuffix').selectOption('prekognicji');
 await page.locator('#goalSteps').selectOption('1');
 await page.locator('#goalSearch').click();
 await page.locator('#goalMissingList').waitFor();
 for(const width of [320,375,768,1024,1440]){
  await page.setViewportSize({width,height:900});await fits(`populated missing ${width}`);
  if(process.env.UI_SCREENSHOTS&&[375,1440].includes(width)){
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:path.join(process.env.UI_SCREENSHOTS,`kuznia-missing-${width}.png`),fullPage:false});
  }
 }
 await page.locator('#craftingTab').click();
 for(const width of [320,375,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});await fits(`populated crafting ${width}`);
  if(process.env.UI_SCREENSHOTS&&[375,1440].includes(width)){
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:path.join(process.env.UI_SCREENSHOTS,`kuznia-crafting-${width}.png`),fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);
 console.log('Responsive browser QA passed: 320–1920 px, both tools, tables, import, profile, item popup, recipe navigation and populated results.');
}finally{await browser.close();server.close();}
