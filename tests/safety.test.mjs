import test from 'node:test';
import assert from 'node:assert/strict';
import {candlesFromRows,settleClosed,oiChangeFromRows} from '../lib/advanced.js';
const dt=900000, now=Date.UTC(2026,9,21,18,0), bar=now-20*dt;
test('reject negative candle turnover',()=>{
 const start=now-100*dt;
 const rows=Array.from({length:99},(_,i)=>[start+i*dt,100,101,99,100,10,1000]);
 rows[20][6]=-1;
 assert.throws(()=>candlesFromRows(rows,dt,now),/INVALID_OHLCV/);
});
test('stale open interest does not affect a new signal',()=>{
 const rows=[0,1,2,3].map(i=>({timestamp:bar+i*dt,openInterest:100+i}));
 assert.equal(oiChangeFromRows(rows,now),null);
});
test('expired signal with missing candles is UNVERIFIED, not TIMEOUT',()=>{
 const s={bar,side:'LONG',tp:110,sl:90,status:'OPEN',expiresAt:bar+4*dt};
 settleClosed(s,[{t:bar+dt,h:105,l:95}],now);
 assert.equal(s.status,'UNVERIFIED');
});
test('expired signal with complete candles can be TIMEOUT',()=>{
 const s={bar,side:'LONG',tp:110,sl:90,status:'OPEN',expiresAt:bar+4*dt};
 settleClosed(s,[1,2,3].map(i=>({t:bar+i*dt,h:105,l:95})),now);
 assert.equal(s.status,'TIMEOUT');
});
