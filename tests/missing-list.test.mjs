import assert from 'node:assert/strict';
import {test} from 'node:test';
import {missingItemList,missingListText,missingPlanListText,missingAffixList} from '../missing-list.js';

const item=(base,missing=true)=>({category:'head',rarity:'normal',base,prefix:'',suffix:'',missing});
const plan=(left,right)=>({left,right});

test('shopping groups preserve ingredient pairs, quantities and original recipe numbers after filtering',()=>{
 const plans=[
  {...plan(item('czapka'),item('maska')),steps:1},
  {...plan(item('korona',false),plan(item('czapka'),item('czapka'))),steps:2},
  {...plan(item('czapka',false),item('maska',false)),steps:1},
 ];
 assert.equal(missingPlanListText(plans),'Zestaw #1 · 1 spaw\n1 - Czapka\n1 - Maska\n\nZestaw #2 · 2 spawy\n2 - Czapka');
 assert.equal(missingPlanListText([plans[1]],plans),'Zestaw #2 · 2 spawy\n2 - Czapka');
 assert.equal(missingPlanListText([]),'');
 assert.equal(missingPlanListText([plans[2]],plans),'');
});

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

test('unique affixes ignore base, gender, quality, duplicates and owned ingredients',()=>{
 const cap={...item('czapka'),prefix:'smiercionosny',suffix:'zmyslow'};
 const helmet={...item('helm'),prefix:'smiercionosny',suffix:'zmyslow',rarity:'legendary'};
 const owned={...item('korona',false),prefix:'szamanski',suffix:'wladzy'};
 const plans=[plan(cap,helmet),plan(owned,plan(cap,helmet)),plan(cap,owned)];
 assert.deepEqual(missingAffixList(plans,'prefix'),['śmiercionośny']);
 assert.deepEqual(missingAffixList(plans,'suffix'),['zmysłów']);
});

test('affixes include all alternatives beyond page one, restore Polish letters and sort by Polish collation',()=>{
 const plans=Array.from({length:100},()=>plan({...item('czapka'),prefix:'zlosliwy',suffix:'skory'},item('maska',false)));
 plans.push(plan({...item('helm'),prefix:'smiercionosny',suffix:'przezornosci'},{...item('korona'),prefix:'bojowy',suffix:'adrenaliny'}));
 assert.deepEqual(missingAffixList(plans,'prefix'),['bojowy','śmiercionośny','złośliwy']);
 assert.deepEqual(missingAffixList(plans,'suffix'),['adrenaliny','przezorności','skóry']);
});

test('missing affixes omit blank axes and never collect intermediate or final outputs',()=>{
 const nested={...plan(item('czapka'),{...item('helm'),suffix:'mocy'}),prefix:'smiercionosny',suffix:'zmyslow'};
 const plans=[{...plan(nested,item('korona',false)),prefix:'szamanski',suffix:'wladzy'}];
 assert.deepEqual(missingAffixList(plans,'prefix'),[]);
 assert.deepEqual(missingAffixList(plans,'suffix'),['mocy']);
 assert.deepEqual(missingAffixList([plan({...item('kusza'),prefix:undefined,suffix:null},item('maska'))],'prefix'),[]);
});

test('empty and fully owned results have no affixes; unsupported axes are rejected',()=>{
 for(const axis of ['prefix','suffix']){
  assert.deepEqual(missingAffixList([],axis),[]);
  assert.deepEqual(missingAffixList([plan({...item('helm',false),prefix:'bojowy',suffix:'mocy'},item('maska',false))],axis),[]);
 }
 assert.throws(()=>missingAffixList([],'base'),RangeError);
});
