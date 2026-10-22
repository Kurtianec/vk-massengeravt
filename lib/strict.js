import {ema} from './core.js';
// 1h trend is checked on closed candles only. Reversal strategies require a
// weaker filter because they deliberately trade a change of direction.
export function hourTrendAllows(signal,rows,now=Date.now()){
 if(!signal||!Array.isArray(rows))return false;
 const c=rows.map(r=>({t:+r[0],close:+r[4]})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.close)&&x.close>0&&x.t+3600000<=now).sort((a,b)=>a.t-b.t);
 if(c.length<205||now-(c.at(-1).t+3600000)>7200000)return false;
 if(c.slice(-205).some((x,i,a)=>i&&x.t-a[i-1].t!==3600000))return false;
 const closes=c.map(x=>x.close),e20=ema(closes,20),e50=ema(closes,50),e200=ema(closes,200),last=closes.at(-1);
 const reversal=['LIQUIDITY_SWEEP','RANGE_REVERSAL','PUMP_EXHAUSTION','DUMP_EXHAUSTION'].includes(signal.strategy);
 if(reversal){return signal.side==='LONG'?last>e200*.94:last<e200*1.06;}
 return signal.side==='LONG'?last>e50&&e20>e50&&e50>e200:last<e50&&e20<e50&&e50<e200;
}
