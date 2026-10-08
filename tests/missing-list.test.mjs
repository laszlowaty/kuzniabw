import assert from 'node:assert/strict';
import {test} from 'node:test';
import {missingItemList,missingListText} from '../missing-list.js';

const item=(base,missing=true)=>({category:'head',rarity:'normal',base,prefix:'',suffix:'',missing});
const plan=(left,right)=>({left,right});

test('alternative recipes do not multiply shopping quantities; owned items are excluded',()=>{
 const plans=Array.from({length:150},()=>plan(item('czapka'),item('korona',false)));
 assert.equal(missingListText(missingItemList(plans)),'1 - Czapka');
});

test('two identical missing ingredients count twice within one recipe, including nested recipes',()=>{
 const cap=item('czapka'),mask=item('maska');
 const plans=[plan(cap,mask),plan(item('korona',false),plan({...cap,id:1},{...cap,id:2})),plan(mask,cap)];
 assert.equal(missingListText(missingItemList(plans)),'2 - Czapka\n1 - Maska');
});

test('list covers all plans beyond the first page and keeps different affixes',()=>{
 const cap=item('czapka');
 const plans=[...Array.from({length:100},()=>plan(cap,item('korona',false))),plan({...cap,suffix:'mocy'},item('maska'))];
 assert.equal(missingListText(missingItemList(plans)),'1 - Czapka\n1 - Czapka mocy\n1 - Maska');
});

test('no matches and fully owned recipes produce an empty list',()=>{
 assert.deepEqual(missingItemList([]),[]);
 assert.equal(missingListText(missingItemList([plan(item('czapka',false),item('maska',false))])), '');
});
