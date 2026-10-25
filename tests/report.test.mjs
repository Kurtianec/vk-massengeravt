import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeTrades} from '../lib/bot.mjs';
test('TP1 counts as successful, TP2 is a subset',()=>{
 const s=summarizeTrades([
  {status:'TP2',side:'LONG',hit1:true},
  {status:'TP1_OPEN',side:'SHORT',hit1:true},
  {status:'TP1_SL',side:'LONG',hit1:true},
  {status:'SL',side:'SHORT',hit1:false},
  {status:'OPEN',side:'LONG',hit1:false},
 ]);
 assert.equal(s.successful,3);assert.equal(s.TP2,1);assert.equal(s.failed,1);
});
test('Ambiguous candle after previously reached TP1 counts as successful',()=>{
 const s=summarizeTrades([{status:'AMBIGUOUS',side:'LONG',priorTP1:true,hit1:true},{status:'AMBIGUOUS',side:'SHORT',priorTP1:false,hit1:false}]);
 assert.equal(s.successful,1);assert.equal(s.failed,0);assert.equal(s.AMBIGUOUS,2);
});
