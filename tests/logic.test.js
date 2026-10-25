import test from 'node:test';import assert from 'node:assert/strict';import {detect,shouldNotify} from '../lib/logic.js';
const make=()=>Array.from({length:90},(_,i)=>({time:i*60000,open:100,high:101,low:99,close:100,volume:100}));
test('flat market is silent',()=>assert.equal(detect(make(),{}).stage,null));
test('no alert without candles',()=>assert.equal(detect([],{}).stage,null));
test('new alert sent',()=>assert.equal(shouldNotify(null,{stage:'EARLY',direction:'PUMP'},Date.now()),true));
test('duplicate suppressed',()=>assert.equal(shouldNotify({stage:'EARLY',direction:'PUMP',notifiedAt:Date.now()},{stage:'EARLY',direction:'PUMP'},Date.now()),false));
test('stage upgrade sent',()=>assert.equal(shouldNotify({stage:'EARLY',direction:'PUMP',notifiedAt:Date.now()},{stage:'CONFIRMED',direction:'PUMP'},Date.now()),true));
