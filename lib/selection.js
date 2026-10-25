import {num} from './logic.js';
// Hot symbols come from recently observed real intraday activity. A 24h change
// is only a fallback heuristic; it does NOT predict a future pump.
export function selectMarket(tickers, {batch,batches=6,hotSize=30,discoverySize=150,minTurnover=3000000,now=Date.now(),recentHot=[]}={}){
 const eligible=tickers.filter(t=>t.symbol?.endsWith('USDT') && num(t.turnover24h)>=minTurnover);
 const bySymbol=new Map(eligible.map(t=>[t.symbol,t]));
 const recent=[...new Set(recentHot)].filter(s=>bySymbol.has(s)).slice(0,hotSize);
 const fallback=eligible.filter(t=>!recent.includes(t.symbol)).sort((a,b)=>{
  const score=t=>Math.abs(num(t.price24hPcnt))*100 + Math.log10(Math.max(1,num(t.turnover24h)))*0.15;
  return score(b)-score(a);
 });
 const hot=[...recent,...fallback.slice(0,Math.max(0,hotSize-recent.length)).map(t=>t.symbol)];
 const hotSet=new Set(hot);
 const rest=eligible.filter(t=>!hotSet.has(t.symbol)).sort((a,b)=>a.symbol.localeCompare(b.symbol));
 // Each six-minute cycle rotates a contiguous discovery window. Across cycles
 // every eligible symbol is eventually sampled, not just the turnover leaders.
 const cycle=Math.floor(now/(batches*60000));
 const window=Math.min(discoverySize,rest.length);
 const start=rest.length?(cycle*discoverySize)%rest.length:0;
 const discovery=Array.from({length:window},(_,i)=>rest[(start+i)%rest.length].symbol);
 const combined=[...hot,...discovery];
 return {eligible:eligible.length,hot:hot.length,discovery:discovery.length,selected:combined.filter((_,i)=>i%batches===batch).map(s=>bySymbol.get(s)),cycle};
}
