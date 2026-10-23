// Offline 15m setup-only evaluation. Does NOT replay 1h/1m/orderbook/news filters.
// Walk-forward chronological split; conservative execution and costs.
import {readFileSync} from 'node:fs';
import {candlesFromRows,createSignal} from '../lib/advanced.js';
const file=process.argv[2],symbol=process.argv[3]||'BTCUSDT';
if(!file){console.error('Usage: npm run backtest -- candles.json BTCUSDT [fee_bps_per_side=6] [slippage_bps_per_side=3]');process.exit(2)}
const feeBps=Number(process.argv[4]??6),slipBps=Number(process.argv[5]??3);
if(![feeBps,slipBps].every(x=>Number.isFinite(x)&&x>=0&&x<100))throw Error('Invalid cost assumption');
const raw=JSON.parse(readFileSync(file,'utf8'));
const all=raw.map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5],turnover:+x[6]})).sort((a,b)=>a.t-b.t);
for(let i=1;i<all.length;i++)if(all[i].t-all[i-1].t!==900000)throw Error(`Non-contiguous input at ${i}`);
const trades=[];let lastExit=-1;
for(let i=210;i<all.length-49;i++){
 const now=all[i].t+900000;if(now<=lastExit)continue;
 let c;try{c=candlesFromRows(all.slice(Math.max(0,i-299),i+1).map(x=>[x.t,x.o,x.h,x.l,x.c,x.v,x.turnover]),900000,now)}catch{continue}
 const {signal}=createSignal(symbol,c,null,null);if(!signal)continue;
 const next=all[i+1],risk=Math.abs(signal.entry-signal.sl),gap=Math.abs(next.o-signal.entry);
 if(next.t!==now||gap>risk*.15)continue;
 const dir=signal.side==='LONG'?1:-1;
 const fill=next.o*(1+dir*slipBps/10000);
 const stop=fill-dir*risk,target=fill+dir*2*risk;
 if(stop<=0||target<=0)continue;
 let outcome='TIMEOUT',exit=all[i+48].c,exitIndex=i+48;
 for(let j=i+1;j<=i+48;j++){
  const x=all[j],hitTp=dir===1?x.h>=target:x.l<=target,hitSl=dir===1?x.l<=stop:x.h>=stop;
  if(hitTp&&hitSl){outcome='AMBIGUOUS';exit=stop;exitIndex=j;break}
  if(hitSl){outcome='SL';exit=stop;exitIndex=j;break}
  if(hitTp){outcome='TP';exit=target;exitIndex=j;break}
 }
 // Adverse exit slippage on SL and on timeouts; target fills are optimistic limit fills.
 if(outcome!=='TP')exit*=1-dir*slipBps/10000;
 const grossR=dir*(exit-fill)/risk;
 const costR=(fill+exit)*feeBps/10000/risk;
 const netR=grossR-costR;
 trades.push({t:next.t,strategy:signal.strategy,side:signal.side,outcome,netR,grossR});
 lastExit=all[exitIndex].t+900000;
}
const splitAt=all[Math.floor(all.length*.7)]?.t;
function stats(a){const n=a.length;const net=a.reduce((s,t)=>s+t.netR,0);const winners=a.filter(t=>t.netR>0).length;
 const by={};for(const t of a){const key=`${t.strategy} ${t.side}`;const b=by[key]??={count:0,netR:0,TP:0,SL:0,TIMEOUT:0,AMBIGUOUS:0};b.count++;b.netR+=t.netR;b[t.outcome]++;}
 return {trades:n,profitableTrades:winners,netR:+net.toFixed(3),meanNetR:n?+(net/n).toFixed(4):null,byStrategyAndSide:by};}
console.log(JSON.stringify({symbol,bars:all.length,split:'Chronological 70% / 30%, NO parameter fitting',assumedFeeBpsPerSide:feeBps,assumedSlippageBpsPerSide:slipBps,inSample:stats(trades.filter(t=>t.t<splitAt)),outOfSample:stats(trades.filter(t=>t.t>=splitAt)),limitations:['15m setup only; live 1h/1m/orderbook/news filters NOT replayed','No funding, latency or order queue simulation','Ambiguous same-bar TP+SL counted as SL','No evidence of profitable live trading without OOS and forward tests']},null,2));
