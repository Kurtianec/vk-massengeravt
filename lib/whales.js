import {num} from './logic.js';
// Bybit public trades: side=Buy means aggressive buyer, not a known wallet.
export function analyzeWhales(trades, previous={}, options={}) {
 const minUsd=num(options.minUsd||100000), windowMs=num(options.windowMs||300000);
 const sorted=(Array.isArray(trades)?trades:[]).filter(t=>num(t.time)>0 && num(t.price)>0 && num(t.size)>0).sort((a,b)=>num(a.time)-num(b.time));
 if(!sorted.length)return {events:[],latestTime:num(previous.latestTime),latestIds:previous.latestIds||[],buyUsd:0,sellUsd:0};
 const newest=num(sorted.at(-1).time), cutoff=newest-windowMs;
 const recent=sorted.filter(t=>num(t.time)>=cutoff);
 const buyUsd=recent.filter(t=>t.side==='Buy').reduce((s,t)=>s+num(t.price)*num(t.size),0);
 const sellUsd=recent.filter(t=>t.side==='Sell').reduce((s,t)=>s+num(t.price)*num(t.size),0);
 const lastTime=num(previous.latestTime), oldIds=new Set(previous.latestIds||[]);
 const fresh=recent.filter(t=>num(t.time)>lastTime || (num(t.time)===lastTime && t.id && !oldIds.has(t.id)));
 const events=fresh.filter(t=>num(t.price)*num(t.size)>=minUsd).map(t=>({side:t.side,usd:num(t.price)*num(t.size),price:num(t.price),time:num(t.time),id:t.id||''}));
 const latestIds=sorted.filter(t=>num(t.time)===newest).map(t=>t.id).filter(Boolean).slice(-200);
 return {events,latestTime:newest,latestIds,buyUsd,sellUsd,coverageSeconds:Math.max(0,(newest-num(recent[0]?.time||newest))/1000),sampleSize:recent.length};
}
