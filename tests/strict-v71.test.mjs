import test from 'node:test';
import assert from 'node:assert/strict';
import {hourTrendAllows} from '../lib/strict.js';
import {settleMinute} from '../lib/outcomes.js';
import {formatSignal} from '../lib/advanced.js';
const now=Date.UTC(2026,0,12,12,30);
const hours=Array.from({length:225},(_,i)=>{const t=now-(225-i)*3600000-1800000;const p=100+i*.1;return [t,p,p+.2,p-.2,p,1000]});
test('hourly confirmation allows aligned trend and rejects opposing',()=>{
 assert.equal(hourTrendAllows({side:'LONG',strategy:'EARLY_PUMP'},hours,now),true);
 assert.equal(hourTrendAllows({side:'SHORT',strategy:'EARLY_DUMP'},hours,now),false);
});
test('touch in delivery minute is not invented as a win',()=>{
 const start=Date.UTC(2026,0,12,12,0);
 const s={status:'OPEN',side:'LONG',tp:102,sl:99,deliveredAt:start+30000,expiresAt:start+3600000};
 settleMinute(s,[[start,100,103,99.5,100],[start+60000,100,101,99.9,100]],start+180000);
 assert.equal(s.status,'UNVERIFIED');assert.equal(s.outcomeReason,'PARTIAL_MINUTE_TOUCH');
});
test('signal message is Russian and uncluttered',()=>{
 const text=formatSignal({side:'LONG',symbol:'ABCUSDT',strategy:'LIQUIDITY_SWEEP',regime:'RANGE',entry:100,tp:102,sl:99,features:{rsi:45,volumeRatio:2},oiChange:null,reasons:['Возврат в диапазон']});
 assert.match(text,/ПОКУПКА/);assert.match(text,/Ложный пробой/);assert.doesNotMatch(text,/89\/100/);
});
