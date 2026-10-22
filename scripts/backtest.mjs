// Offline walk-forward evaluator: run with a JSON file of Bybit kline rows.
// No tuning on test data; entries only at the NEXT candle open, conservatively.
import {readFileSync} from 'node:fs';
import {candlesFromRows,createSignal,settleClosed} from '../lib/advanced.js';
const file=process.argv[2],symbol=process.argv[3]||'BTCUSDT';
if(!file){console.error('Usage: npm run backtest -- data.json BTCUSDT');process.exit(2)}
const rows=JSON.parse(readFileSync(file,'utf8'));
const all=rows.map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5],turnover:+x[6]})).sort((a,b)=>a.t-b.t);
let trades=[],lastExit=-1;
for(let i=210;i<all.length-49;i++){
 const current=all.slice(0,i+1),now=all[i].t+900000;
 if(now<=lastExit)continue;
 let c;try{c=candlesFromRows(current.slice(-300).map(x=>[x.t,x.o,x.h,x.l,x.c,x.v,x.turnover]),900000,now)}catch{continue}
 const {signal}=createSignal(symbol,c,null,null,80);if(!signal)continue;
 // Real entry on next candle OPEN, not at already closed signal candle.
 const next=all[i+1];if(next.t!==now)continue;
 const risk=Math.abs(signal.entry-signal.sl),gap=Math.abs(next.o-signal.entry);
 if(gap>risk*.25)continue;
 signal.entry=next.o;signal.sl=signal.side==='LONG'?next.o-risk:next.o+risk;
 signal.tp=signal.side==='LONG'?next.o+2*risk:next.o-2*risk;
 signal.bar=all[i].t;signal.expiresAt=next.t+48*900000;
 const follow=all.slice(i+1,i+49);
 settleClosed(signal,follow,follow.at(-1).t+900000);
 const outcome=signal.status;
 trades.push({strategy:signal.strategy,side:signal.side,status:outcome,entry:signal.entry});
 lastExit=signal.closedAt||signal.expiresAt;
}
const stats={};for(const t of trades){const x=stats[t.strategy]??={TP:0,SL:0,AMBIGUOUS:0,TIMEOUT:0,UNVERIFIED:0};x[t.status]=(x[t.status]||0)+1;}
console.log(JSON.stringify({symbol,bars:all.length,trades:trades.length,strategies:stats,disclaimer:'No fees/slippage modeled; candle-based, conservative dual-touch=AMBIGUOUS; not a validated win rate.'},null,2));
