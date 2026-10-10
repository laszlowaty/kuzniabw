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
 const page=await browser.newPage({viewport:{width:375,height:812},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>document.querySelector('#catalogStatus').textContent.includes('Dane R21 gotowe'));
 const sizes=[{width:320,height:568},{width:375,height:812},{width:430,height:932},{width:667,height:375},{width:375,height:360},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900},{width:1920,height:1080}];
 async function chrome(id,label){
  const result=await page.locator(id).evaluate(dialog=>{
   const within=e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;};
   const body=dialog.querySelector('.dialogBody'),head=dialog.querySelector('.panelHead'),actions=dialog.querySelector('.dialogActions');
   return {dialog:within(dialog),head:within(head),actions:within(actions),bodyHeight:body.clientHeight,noOverflow:body.scrollWidth<=body.clientWidth+1,page:document.documentElement.scrollWidth<=innerWidth,
    unobscured:[...actions.querySelectorAll('button'),head.querySelector('button')].every(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})};
  });
  assert.ok(result.dialog&&result.head&&result.actions&&result.noOverflow&&result.page&&result.unobscured&&result.bodyHeight>=100,`${label}: ${JSON.stringify(result)}`);
 }
 async function screenshot(name){if(process.env.UI_SCREENSHOTS){fs.mkdirSync(process.env.UI_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.UI_SCREENSHOTS,name+'.png')});}}
 for(const size of sizes){
  await page.setViewportSize(size);await page.locator('#editInventory').click();
  await page.locator('#inventoryDialog .dialogHelp').evaluate(e=>e.open=false);
  await chrome('#inventoryDialog',`import ${JSON.stringify(size)}`);
  if(size.width===375&&size.height===812)await screenshot('import-mobile');
  if(size.width===1440)await screenshot('import-desktop');
  if(size.width===667)await screenshot('import-landscape');
  await page.locator('#inventoryDialog .dialogHelp summary').click();
  await page.locator('#inventoryText').fill(Array(100).fill('Dobry Tygrysi Hełm Adrenaliny (+5)').join('\n')+'\n'+('nierozpoznanytekst'.repeat(40)));
  await page.locator('#validateText').click();
  assert.equal(await page.locator('.importPreview li').count(),100);
  await page.locator('#parseFeedback details').last().locator('summary').click();
  await chrome('#inventoryDialog',`long preview ${JSON.stringify(size)}`);
  await page.locator('#inventoryDialog .dialogBody').evaluate(e=>e.scrollTop=e.scrollHeight);
  await chrome('#inventoryDialog',`scrolled import ${JSON.stringify(size)}`);
  await page.locator('#closeDialog').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'editInventory');
 }
 await page.setViewportSize({width:375,height:812});
 await page.locator('#editInventory').click();
 await page.locator('#inventoryText').fill('nie ma przedmiotów');await page.locator('#inventoryForm button[type=submit]').click();
 assert.ok(await page.locator('#inventoryDialog').isVisible(),'Invalid import leaves editor open');
 assert.equal(await page.locator('#inventoryCount').textContent(),'0');
 await page.locator('#inventoryText').fill(['Dobry Tygrysi Hełm Adrenaliny (+5)',...Array(7).fill('Kusza Doskonałości (+1)')].join('\n'));
 await page.locator('#inventoryForm button[type=submit]').click();
 assert.equal(await page.locator('#inventoryCount').textContent(),'8');
 await page.locator('#inventoryContents > summary').click();
 const trigger=page.locator('#inventoryList .itemInfoTrigger').first();
 await trigger.scrollIntoViewIfNeeded();await page.waitForTimeout(100);await trigger.tap();
 await page.locator('#itemInfo .itemExtra summary').first().click();
 await page.waitForTimeout(100);
 assert.ok(await page.locator('#itemInfo').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth;}),'Expanded popup stays in viewport');
 await page.locator('#itemInfo').evaluate(e=>e.scrollTop=e.scrollHeight);
 assert.ok(await page.locator('#closeItemInfo').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Popup close stays reachable after scrolling');
 await screenshot('item-mobile');await page.locator('#closeItemInfo').click();
 await page.locator('#journeyTab').click();await page.locator('#journeyTable .journeyChance').first().waitFor();
 for(const size of sizes){
  await page.setViewportSize(size);await page.locator('#journeyGear').click();
  await chrome('#gearDialog',`gear ${JSON.stringify(size)}`);
  if(size.width===375&&size.height===812)await screenshot('gear-mobile');
  if(size.width===1440)await screenshot('gear-desktop');
  if(size.width===667)await screenshot('gear-landscape');
  await page.locator('#gearDialog .gearPaste summary').click();
  await page.locator('#gearPasteText').fill('Poziom: 150\nSIŁA: 100\nZWINNOŚĆ: 100\nŁatwość: 10%');
  await chrome('#gearDialog',`stats paste ${JSON.stringify(size)}`);
  await page.locator('#gearPasteRead').click();
  assert.equal(await page.locator('#gear-level').inputValue(),'150');
  assert.equal(await page.locator('#gear-ease').inputValue(),'10');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'journeyGear');
 }
 await page.setViewportSize({width:375,height:812});await page.locator('#journeyGear').click();
 await page.locator('#gear-level').fill('');await page.locator('#gearSearch').click();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'gear-level','Invalid field receives focus');
 await page.locator('#gear-level').fill('150');
 for(const input of await page.locator('#gearTraining input').all())await input.fill('100');
 await page.locator('#gearSearch').click();
 await page.waitForFunction(()=>document.querySelector('#gearStatus').textContent.startsWith('Gotowe'),null,{timeout:120000});
 assert.ok(await page.locator('.gearLocation').count()>1);
 for(const size of sizes){await page.setViewportSize(size);await chrome('#gearDialog',`gear results ${JSON.stringify(size)}`);}
 await page.setViewportSize({width:375,height:812});
 await page.locator('#gearDetail').scrollIntoViewIfNeeded();await screenshot('gear-results-mobile');
 const item=page.locator('#gearDetail .itemInfoTrigger').first();
 assert.ok(await item.count(),'Suggested gear includes an item');
 await item.scrollIntoViewIfNeeded();await page.waitForTimeout(100);await item.tap();
 assert.ok(await page.locator('#gearDialog #itemInfo').isVisible(),'Item preview works inside the modal top layer');
 await page.locator('#closeItemInfo').click();
 await page.locator('#gearApply').click();
 assert.equal(await page.locator('#gearDialog').isVisible(),false);
 assert.equal(await page.locator('#inventoryCount').textContent(),'8','Applying gear preserves inventory');
 await page.reload();await page.waitForFunction(()=>document.querySelector('#catalogStatus').textContent.includes('Dane R21 gotowe'));
 assert.equal(await page.locator('#inventoryCount').textContent(),'0','Reload retains the existing empty-inventory startup');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kuzniaJourneyGear')).level),150,'Character settings persist');
 assert.deepEqual(errors,[]);
 console.log('Dialog QA passed: 9 viewports, short/landscape screens, 100-item import, errors, focus, stats paste, gear search/apply, nested popup, persistence and no JS errors.');
}finally{await browser.close();server.close();}
