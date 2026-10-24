import test from 'node:test';
import assert from 'node:assert/strict';
import {isFreshCandle,reportCycle,eligibleMinute} from '../lib/bot.mjs';
test('rejects stale and still-open 15m candles',()=>{const now=1_800_000_000_000;assert.equal(isFreshCandle(now-15*60000,now),true);assert.equal(isFreshCandle(now-14*60000,now),false);assert.equal(isFreshCandle(now-32*60000,now),false)});
test('report never combines scan cycles',()=>{const now=1_800_000_000_000;const rows=[{cycle:10,at:now-1000},{cycle:10,at:now-2000},{cycle:9,at:now-3000}];assert.equal(reportCycle(rows,now).length,2)});
test('settlement ignores bars starting before notification',()=>{const t={createdAt:125000};assert.equal(eligibleMinute(t,{t:120000}),false);assert.equal(eligibleMinute(t,{t:180000}),true)});
