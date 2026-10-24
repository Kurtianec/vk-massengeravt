import test from 'node:test';import assert from 'node:assert/strict';import {rsi,settleCandle,evaluate} from '../lib/core.mjs';
test('RSI enough data',()=>assert.equal(rsi([1,2,3]),null));
test('both TP and SL in candle ambiguous',()=>{const t={side:'LONG',tp1:105,tp2:110,sl:95,hit1:false};assert.equal(settleCandle(t,{t:1,h:106,l:94}).status,'AMBIGUOUS')});
test('TP1 then stop is tracked',()=>{let t={side:'LONG',tp1:105,tp2:110,sl:95,hit1:false,status:'OPEN'};t=settleCandle(t,{t:1,h:106,l:99});assert.equal(t.status,'TP1_OPEN');t=settleCandle(t,{t:2,h:103,l:94});assert.equal(t.status,'TP1_SL')});
test('no signal on missing inputs',()=>assert.equal(evaluate({symbol:'BTCUSDT',candles:[],oiChange:1,volumeRatio:2}),null));
