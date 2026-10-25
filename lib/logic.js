export const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
export function detect(candles, ticker, prev = null, cfg = {}) {
  const minVolume = num(cfg.minVolume || 2.5);
  if (!Array.isArray(candles) || candles.length < 65) return {stage:null, reason:'not_enough_candles'};
  // Input: oldest -> newest, CLOSED candles only.
  const c = candles;
  const last = c.at(-1), p1=c.at(-2), p5=c.at(-6), p15=c.at(-16);
  if (![last,p1,p5,p15].every(x=>x?.close>0)) return {stage:null,reason:'invalid_price'};
  const ch1=(last.close/p1.close-1)*100, ch5=(last.close/p5.close-1)*100, ch15=(last.close/p15.close-1)*100;
  const direction = ch5>=0?'PUMP':'DUMP'; const sign=direction==='PUMP'?1:-1;
  const vBase=c.slice(-65,-5).reduce((s,x)=>s+x.volume,0)/60;
  const vRecent=c.slice(-5).reduce((s,x)=>s+x.volume,0)/5;
  const rv=vBase>0?vRecent/vBase:0;
  const absReturns=c.slice(-65,-5).map((x,i,a)=>i?Math.abs((x.close/a[i-1].close-1)*100):0).slice(1);
  const avgMove=absReturns.reduce((a,b)=>a+b,0)/Math.max(1,absReturns.length);
  const anomaly=Math.abs(ch5)/Math.max(avgMove*Math.sqrt(5),0.15);
  const history=c.slice(-26,-6); const high=Math.max(...history.map(x=>x.high)); const low=Math.min(...history.map(x=>x.low));
  const breakout=sign===1?last.close>high:last.close<low;
  const acceleration=sign*ch1>0.2 && sign*ch5>sign*ch15/3;
  const oi=num(ticker?.openInterest); const oldOi=num(prev?.oi);
  const oiChange=oldOi>0?(oi/oldOi-1)*100:null;
  let stage=null;
  if (Math.abs(ch5)>=2 && rv>=minVolume && anomaly>=2 && acceleration) stage='EARLY';
  if (Math.abs(ch5)>=4 && rv>=3.5 && anomaly>=2.5 && breakout) stage='CONFIRMED';
  // EXHAUSTION is only a follow-up to an already detected move in the same direction.
  if (prev?.direction===direction && ['EARLY','CONFIRMED'].includes(prev?.stage) &&
      Math.abs(ch15)>=5 && sign*ch1< -0.35 && rv>=1.2) stage='EXHAUSTION';
  return {stage,direction,price:last.close,ch1,ch5,ch15,rv,anomaly,breakout,oiChange,oi,closedAt:last.time,reason:stage?'matched':'thresholds_not_met'};
}
export function shouldNotify(prev, now, ts, cooldownMs=30*60*1000) {
  if (!now.stage) return false;
  if (!prev?.stage || prev.direction!==now.direction) return true;
  const rank={EARLY:1,CONFIRMED:2,EXHAUSTION:3};
  if (rank[now.stage]>rank[prev.stage]) return true;
  return ts-num(prev.notifiedAt)>=cooldownMs && now.stage!== 'EXHAUSTION';
}
