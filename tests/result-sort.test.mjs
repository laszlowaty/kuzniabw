import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sortResults} from '../result-sort.js';

test('result order offers strong pairs, fewest fusions, and most fusions',()=>{
 const short={category:'head',prefix:'wzmocniony',suffix:'pasterza',steps:1};
 const long={category:'head',prefix:'wzmocniony',suffix:'pasterza',steps:5};
 const strongLong={category:'head',prefix:'tygrysi',suffix:'adrenaliny',steps:4};
 const strongShort={category:'head',prefix:'tygrysi',suffix:'adrenaliny',steps:2};
 const results=[short,long,strongLong,strongShort];
 assert.deepEqual(sortResults(results,'best'),[strongShort,strongLong,short,long]);
 assert.deepEqual(sortResults(results,'fewest'),[short,strongShort,strongLong,long]);
 assert.deepEqual(sortResults(results,'most'),[long,strongLong,strongShort,short]);
 assert.deepEqual(results,[short,long,strongLong,strongShort]);
});
