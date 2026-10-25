import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeWhales} from '../lib/whales.js';
test('finds only fresh large executions',()=>{
 const trades=[{id:'a',time:1000000,price:2,size:60000,side:'Buy'},{id:'b',time:1000001,price:2,size:20000,side:'Sell'}];
 const x=analyzeWhales(trades,{latestTime:999999},{minUsd:100000});
 assert.equal(x.events.length,1);assert.equal(x.events[0].usd,120000);
 const y=analyzeWhales(trades,{latestTime:x.latestTime,latestIds:x.latestIds},{minUsd:100000});
 assert.equal(y.events.length,0);
});
