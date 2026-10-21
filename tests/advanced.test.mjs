import test from 'node:test';import assert from 'node:assert/strict';import {candlesFromRows,marketFeatures,createSignal} from '../lib/advanced.js';
const interval=900000;const base=Math.floor(Date.now()/interval)*interval-95*interval;
function rows(n=95){return Array.from({length:n},(_,i)=>{const p=1+i*.001;return [base+i*interval,String(p),String(p+.002),String(p-.002),String(p+.0005),'100','100']})}
test('reject missing candle',()=>{const r=rows();r.splice(20,1);assert.throws(()=>candlesFromRows(r),/CANDLE_GAP/)});
test('reject bad OHLCV',()=>{const r=rows();r[3][2]='0';assert.throws(()=>candlesFromRows(r),/INVALID_OHLCV/)});
test('accept closed candles and compute features',()=>{const c=candlesFromRows(rows());assert.ok(c.length>=80);assert.ok(Number.isFinite(marketFeatures(c).rsi));});
test('signals never contain execution instructions',()=>{const c=candlesFromRows(rows());const x=createSignal('TESTUSDT',c,null,null);assert.equal('orderId' in (x.signal||{}),false)});
