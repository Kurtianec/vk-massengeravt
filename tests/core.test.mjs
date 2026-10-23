import {test} from 'node:test';import {strict as assert} from 'node:assert';import {resolveTrade,pivots,atr} from '../lib/core.mjs';
const trade={side:'LONG',barTime:0,stop:90,tp:[105,110,115],hits:[]};
test('partial targets then stop',()=>{const r=resolveTrade(trade,[{time:1,high:106,low:99},{time:2,high:104,low:89}]);assert.equal(r.status,'PARTIAL_SL');assert.deepEqual(r.hits,[1])});
test('stop priority ambiguous minute',()=>{const r=resolveTrade(trade,[{time:1,high:116,low:89}]);assert.equal(r.status,'SL');assert.equal(r.ambiguous,true)});
test('all targets',()=>{const r=resolveTrade(trade,[{time:1,high:116,low:100}]);assert.equal(r.status,'TP3')});
test('pivots',()=>assert.ok(pivots([{high:1,low:1},{high:2,low:0},{high:1,low:1}],1,1).length===2));
