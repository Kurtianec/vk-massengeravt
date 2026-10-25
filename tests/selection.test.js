import test from 'node:test';import assert from 'node:assert/strict';
import {selectMarket} from '../lib/selection.js';
const tickers=Array.from({length:240},(_,i)=>({symbol:`COIN${String(i).padStart(3,'0')}USDT`,turnover24h:4000000,price24hPcnt:i===239?'0.95':'0.01'}));
test('hot candidate includes volatile coin even at end of input',()=>{
 const result=selectMarket(tickers,{batch:0,now:0});
 assert.equal(result.hot,30);assert.equal(result.discovery,150);
 const all=Array.from({length:6},(_,batch)=>selectMarket(tickers,{batch,now:0}).selected.map(t=>t.symbol)).flat();
 assert.equal(new Set(all).size,180);assert.ok(all.includes('COIN239USDT'));
});
test('discovery rotates and eventually covers all eligible',()=>{
 const seen=new Set();
 for(let cycle=0;cycle<5;cycle++)for(let batch=0;batch<6;batch++){
  const r=selectMarket(tickers,{batch,now:cycle*60000});r.selected.forEach(t=>seen.add(t.symbol));
 }
 assert.equal(seen.size,240);
});
test('recent signals get priority in hot list',()=>{
 const all=Array.from({length:6},(_,batch)=>selectMarket(tickers,{batch,now:0,recentHot:['COIN001USDT']}).selected.map(t=>t.symbol)).flat();
 assert.ok(all.includes('COIN001USDT'));
});
