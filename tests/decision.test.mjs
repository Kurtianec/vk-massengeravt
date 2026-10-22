import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmEntry} from '../lib/decision.js';
const now=Date.UTC(2026,0,1,12,0,0);
const bars=Array.from({length:20},(_,i)=>{const t=now-(20-i)*60000;return [t,100,100.2,99.8,100,100,10000]});
const setup={entry:100,sl:99,tp:102,side:'LONG',features:{rsi:55}};
const book={b:Array.from({length:10},()=>[99.9,5]),a:Array.from({length:10},()=>[100.1,5])};
test('confirms with fresh minute bars, tight spread, balanced book',()=>{
 const r=confirmEntry(setup,bars,book,{lastPrice:'100',bid1Price:'99.99',ask1Price:'100.01'},now);
 assert.equal(r.allow,true);assert.equal(r.signal.confirmation,'1m+spread+depth');
});
test('rejects late price entry',()=>{
 assert.equal(confirmEntry(setup,bars,book,{lastPrice:'101',bid1Price:'100.99',ask1Price:'101.01'},now).reason,'LATE_ENTRY');
});
test('rejects large spread',()=>{
 assert.equal(confirmEntry(setup,bars,book,{lastPrice:'100',bid1Price:'99.7',ask1Price:'100.3'},now).reason,'WIDE_SPREAD');
});
test('rejects missing minute bars',()=>{
 assert.equal(confirmEntry(setup,bars.slice(0,3),book,{lastPrice:'100',bid1Price:'99.99',ask1Price:'100.01'},now).reason,'INSUFFICIENT_MINUTE_HISTORY');
});
