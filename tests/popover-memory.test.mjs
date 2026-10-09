import assert from 'node:assert/strict';
import {test} from 'node:test';
import {popoverItem,detailContent} from '../item-popover.js';
import {itemClass} from '../engine.js';
import {detailKey} from '../item-details.js';

test('popover display data preserves quality without retaining any recipe graph',()=>{
 const leaf={category:'head',rarity:'normal',base:'czapka',prefix:'',suffix:'',original:'Dobra Czapka (+1)'};
 const plan={...leaf,left:leaf,right:leaf,recipes:[],evidence:[{}],mask:3n};
 plan.recipes.push(plan);
 const snapshot=popoverItem(plan);
 assert.equal(itemClass(snapshot),itemClass(plan));
 assert.equal(detailKey(snapshot),detailKey(plan));
 assert.equal(snapshot.crafted,true);
 for(const key of ['left','right','recipes','evidence','mask'])assert.equal(snapshot[key],undefined);
 assert.doesNotThrow(()=>JSON.stringify(snapshot));
 assert.match(detailContent(snapshot,null,null,{}),/Jakość wyniku spawu/);
 assert.equal(itemClass(popoverItem({...leaf,original:'Nieznany (+99)'})),null);
});
