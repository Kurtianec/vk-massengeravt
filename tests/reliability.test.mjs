import test from 'node:test';
import assert from 'node:assert/strict';
import {isFreshCandle,reportCycle,eligibleMinute,scanCycle,validQuote,selectSymbols} from '../lib/bot.mjs';
test('rejects stale and still-open 15m candles',()=>{const now=1_800_000_000_000;assert.equal(isFreshCandle(now-15*60000,now),true);assert.equal(isFreshCandle(now-14*60000,now),false);assert.equal(isFreshCandle(now-32*60000,now),false)});
test('report never combines scan cycles',()=>{const now=1_800_000_000_000;const rows=[{cycle:10,batch:0,at:now-1000},{cycle:10,batch:1,at:now-2000},{cycle:9,batch:0,at:now-3000}];assert.equal(reportCycle(rows,now).length,2)});
test('settlement ignores bars starting before notification',()=>{const t={createdAt:125000};assert.equal(eligibleMinute(t,{t:120000}),false);assert.equal(eligibleMinute(t,{t:180000}),true)});

test('report prefers last complete six-batch cycle',()=>{const now=1_800_000_000_000;const rows=[...Array.from({length:6},(_,batch)=>({cycle:10,batch,at:now-20000})),{cycle:11,batch:0,at:now-1000}];const found=reportCycle(rows,now);assert.equal(found.length,6);assert.equal(found[0].cycle,10)});
test('cycle uses 15 minute boundaries',()=>{assert.equal(scanCycle(900000),1);assert.equal(scanCycle(899999),0)});
test('reject invalid order book quotes',()=>{assert.equal(validQuote(0,1),false);assert.equal(validQuote(2,1),false);assert.equal(validQuote(NaN,1),false);assert.equal(validQuote(1,1.001),true)});

test('universe diagnostic respects original 10m threshold',()=>{const r=selectSymbols([{symbol:"AAAUSDT",turnover24h:"12000000"},{symbol:"BBBUSDT",turnover24h:"9000000"},{symbol:"CCCUSD",turnover24h:"20000000"}]);assert.deepEqual(r.selected,["AAAUSDT"]);assert.equal(r.universe.usdt,2);assert.equal(r.universe.aboveTurnover,1)});
