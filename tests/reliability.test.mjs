import test from 'node:test';
import assert from 'node:assert/strict';
import {settleClosed,oiChangeFromRows} from '../lib/advanced.js';
const now=Date.UTC(2026,9,21,17,0);
const bar=now-10*900000;
const base={symbol:'ABCUSDT',side:'LONG',entry:100,tp:104,sl:98,bar,status:'OPEN',expiresAt:bar+900000+12*3600000};
test('outcome ignores signal candle',()=>{const s={...base};settleClosed(s,[{t:bar,h:110,l:90}],now);assert.equal(s.status,'OPEN')});
test('dual TP SL in one bar is ambiguous',()=>{const s={...base};settleClosed(s,[{t:bar+900000,h:105,l:97}],now);assert.equal(s.status,'AMBIGUOUS')});
test('OI rejects missing samples and future snapshots',()=>{const rows=[0,1,2,3].map(i=>({timestamp:bar+i*900000,openInterest:100+i}));assert.equal(oiChangeFromRows(rows,bar+3*900000),null);assert.ok(oiChangeFromRows(rows,bar+5*900000)>0)});
