import test from 'node:test';import assert from 'node:assert/strict';import {settleMinute} from '../lib/outcomes.js';
const t=Date.UTC(2026,0,1);const s=()=>({status:'OPEN',side:'LONG',entry:100,tp:102,sl:99,confirmedAt:t,expiresAt:t+180000});
test('minute TP',()=>{const a=s();settleMinute(a,[[t,100,102.2,99.5,101,1]],t+60000);assert.equal(a.status,'TP')});
test('dual touch is ambiguous',()=>{const a=s();settleMinute(a,[[t,100,102.2,98.5,101,1]],t+60000);assert.equal(a.status,'AMBIGUOUS')});
test('missing candle cannot be declared TP',()=>{const a=s();settleMinute(a,[[t+60000,100,102.2,99.5,101,1]],t+120000);assert.equal(a.status,'UNVERIFIED')});
test('complete expiry is timeout',()=>{const a=s();settleMinute(a,Array.from({length:3},(_,i)=>[t+i*60000,100,101,99.5,100,1]),t+180000);assert.equal(a.status,'TIMEOUT')});
