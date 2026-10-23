import test from 'node:test';import assert from 'node:assert/strict';import {resolveTrade,pivots} from '../lib/core.mjs';
const t={side:'LONG',tp:[110,120],stop:95,hits:[],barTime:0,createdAt:60000};
test('TP1 then SL',()=>{const x=resolveTrade(t,[{time:60000,low:100,high:111},{time:120000,low:94,high:105}]);assert.equal(x.status,'PARTIAL_SL');assert.deepEqual(x.hits,[1])});
test('simultaneous TP and SL ambiguous',()=>{const x=resolveTrade(t,[{time:60000,low:94,high:111}]);assert.equal(x.status,'AMBIGUOUS')});
test('both targets',()=>{const x=resolveTrade(t,[{time:60000,low:100,high:111},{time:120000,low:108,high:121}]);assert.equal(x.status,'TP2')});
test('before signal ignored',()=>{const x=resolveTrade(t,[{time:0,low:90,high:125}]);assert.equal(x.status,'OPEN')});
test('pivots',()=>assert.ok(Array.isArray(pivots([]))));
