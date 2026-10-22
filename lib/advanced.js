import {ema,rsi,stochRsi} from './core.js';
export const VERSION='5.2.0';
const finite=x=>Number.isFinite(x);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function candlesFromRows(rows,intervalMs=900000,now=Date.now()){
 if(!Array.isArray(rows))throw Error('INVALID_CANDLE_ROWS');
 const c=rows.map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5],turnover:+x[6]})).sort((a,b)=>a.t-b.t).filter(x=>x.t+intervalMs<=now);
 if(c.length<80)throw Error('NOT_ENOUGH_CLOSED_BARS');
 for(let i=0;i<c.length;i++){
  const x=c[i];if(![x.t,x.o,x.h,x.l,x.c,x.v,x.turnover].every(finite)||x.l<=0||x.v<0||x.turnover<0||x.h<Math.max(x.o,x.c)||x.l>Math.min(x.o,x.c))throw Error('INVALID_OHLCV');
  if(x.t%intervalMs!==0)throw Error('UNALIGNED_CANDLE');
  if(i&&x.t===c[i-1].t)throw Error('DUPLICATE_CANDLE');
  if(i&&x.t-c[i-1].t!==intervalMs)throw Error('CANDLE_GAP');
 }
 if(now-(c.at(-1).t+intervalMs)>intervalMs*2)throw Error('STALE_CANDLES');
 return c;
}
export function atr(c,n=14){if(c.length<n+1)return null;const tr=c.slice(1).map((x,i)=>Math.max(x.h-x.l,Math.abs(x.h-c[i].c),Math.abs(x.l-c[i].c)));let v=tr.slice(0,n).reduce((a,b)=>a+b,0)/n;for(const x of tr.slice(n))v=(v*(n-1)+x)/n;return v;}
export function marketFeatures(c){const x=c.at(-1),cl=c.map(z=>z.c),e20=ema(cl,20),e50=ema(cl,50),e200=ema(cl,200);const a=atr(c);const volBase=c.slice(-21,-1).reduce((s,z)=>s+z.v,0)/20;const top=Math.max(...c.slice(-21,-1).map(z=>z.h)),bottom=Math.min(...c.slice(-21,-1).map(z=>z.l));const ret=(x.c/c.at(-5).c-1)*100;return {price:x.c,bar:x.t,rsi:rsi(cl),stoch:stochRsi(cl),ema20:e20,ema50:e50,ema200:e200,atr:a,atrPct:a/x.c*100,volumeRatio:x.v/Math.max(volBase,1e-12),high20:top,low20:bottom,momentum4:ret,body:(x.c-x.o)/(x.h-x.l||1),upperWick:(x.h-Math.max(x.o,x.c))/(x.h-x.l||1),lowerWick:(Math.min(x.o,x.c)-x.l)/(x.h-x.l||1)};}
export function classify(f){if(f.volumeRatio>2.7&&Math.abs(f.momentum4)>5)return 'EXPLOSIVE';if(f.atrPct>5)return 'HIGH_VOLATILITY';if(Math.abs(f.ema20/f.ema50-1)*100>1.2&&Math.abs(f.momentum4)>1)return 'TREND';return 'RANGE';}
function idea(strategy,side,score,reasons){return {strategy,side,score:Math.round(clamp(score,0,100)),reasons};}
export function evaluateStrategies(c,f,oiChange=null,funding=null){const x=c.at(-1),p=c.at(-2),up=f.ema20>f.ema50,down=f.ema20<f.ema50;const out=[];
 // Signals are confirmations, not overbought/oversold contrarian bets.
 if(x.c>f.high20&&f.volumeRatio>=1.7&&f.momentum4>1.5&&f.rsi<85)out.push(idea('EARLY_IMPULSE','LONG',60+Math.min(18,f.volumeRatio*4)+(oiChange>1?8:0),['Пробой 20-свечного максимума','Объём выше нормы','Ускорение цены']));
 if(x.c<f.low20&&f.volumeRatio>=1.7&&f.momentum4< -1.5&&f.rsi>15)out.push(idea('EARLY_IMPULSE','SHORT',60+Math.min(18,f.volumeRatio*4)+(oiChange>1?8:0),['Пробой 20-свечного минимума','Объём выше нормы','Ускорение вниз']));
 const peak=Math.max(...c.slice(-13,-1).map(z=>z.h)),trough=Math.min(...c.slice(-13,-1).map(z=>z.l));const rise=(peak/c.at(-35).c-1)*100,fall=(trough/c.at(-35).c-1)*100;
 if(rise>12&&x.c<f.ema20&&p.c>=f.ema20&&f.rsi<62&&f.upperWick<.6)out.push(idea('PUMP_EXHAUSTION','SHORT',66+Math.min(15,rise/3)+(f.volumeRatio>1.3?6:0),['Предыдущий сильный рост','Потеря EMA20 на закрытой свече','Ослабление RSI']));
 if(fall< -12&&x.c>f.ema20&&p.c<=f.ema20&&f.rsi>38)out.push(idea('DUMP_EXHAUSTION','LONG',66+Math.min(15,-fall/3),['Предыдущее сильное падение','Возврат над EMA20','Восстановление RSI']));
 if(up&&x.c>f.ema20&&p.l<=f.ema20&&f.rsi>=48&&f.rsi<=72&&x.c>x.o&&f.volumeRatio>.9)out.push(idea('TREND_CONTINUATION','LONG',64+Math.min(15,f.volumeRatio*6),['EMA20 выше EMA50','Ретест EMA20','Бычья закрытая свеча']));
 if(down&&x.c<f.ema20&&p.h>=f.ema20&&f.rsi>=28&&f.rsi<=52&&x.c<x.o&&f.volumeRatio>.9)out.push(idea('TREND_CONTINUATION','SHORT',64+Math.min(15,f.volumeRatio*6),['EMA20 ниже EMA50','Ретест EMA20','Медвежья закрытая свеча']));
 if(x.h>f.high20&&x.c<f.high20&&f.upperWick>.35&&f.volumeRatio>1.2)out.push(idea('LIQUIDITY_SWEEP','SHORT',68+Math.min(14,f.volumeRatio*4),['Ложный пробой максимума','Возврат под сопротивление','Длинная верхняя тень']));
 if(x.l<f.low20&&x.c>f.low20&&f.lowerWick>.35&&f.volumeRatio>1.2)out.push(idea('LIQUIDITY_SWEEP','LONG',68+Math.min(14,f.volumeRatio*4),['Ложный пробой минимума','Возврат над поддержкой','Длинная нижняя тень']));
 if(classify(f)==='RANGE'&&x.c<f.low20*1.006&&f.rsi<40&&x.c>x.o)out.push(idea('RANGE_REVERSAL','LONG',65,['Граница диапазона','RSI низкий','Покупатели удержали закрытие']));
 if(classify(f)==='RANGE'&&x.c>f.high20*.994&&f.rsi>60&&x.c<x.o)out.push(idea('RANGE_REVERSAL','SHORT',65,['Граница диапазона','RSI высокий','Продавцы удержали закрытие']));
 return out.sort((a,b)=>b.score-a.score);
}
export function createSignal(symbol,c,oiChange,funding,threshold=80){
 const f=marketFeatures(c),regime=classify(f),ideas=evaluateStrategies(c,f,oiChange,funding);
 const rejected=reason=>({signal:null,regime:reason,features:f});
 if(!ideas.length)return rejected('NO_SETUP');
 if(![f.price,f.atr,f.atrPct,f.rsi,f.volumeRatio,f.ema20,f.ema50].every(finite))return rejected('INVALID_FEATURES');
 // No reliable setup when the 15m market is too quiet or excessively unstable.
 if(f.atrPct<0.18||f.atrPct>5||f.volumeRatio>12)return rejected('UNSAFE_VOLATILITY');
 if(regime==='HIGH_VOLATILITY')return rejected('HIGH_VOLATILITY');
 const allowed=ideas.filter(i=>{
  if(i.score<threshold)return false;
  // A breakout is not an early entry after an already stretched move.
  if(i.strategy==='EARLY_IMPULSE'){
   if(regime!=='TREND'||Math.abs(f.momentum4)>4.5)return false;
   if(Math.abs(f.price/f.ema20-1)>Math.max(0.025,1.6*f.atr/f.price))return false;
   if(i.side==='LONG'&&f.ema20<=f.ema50)return false;
   if(i.side==='SHORT'&&f.ema20>=f.ema50)return false;
  }
  if(i.strategy==='TREND_CONTINUATION'&&regime!=='TREND')return false;
  if(i.strategy==='RANGE_REVERSAL'&&regime!=='RANGE')return false;
  if(i.strategy.includes('EXHAUSTION')&&regime==='EXPLOSIVE')return false;
  return true;
 });
 if(!allowed.length)return rejected('FILTERED');
 const best=allowed[0];
 if(ideas.some(z=>z.side!==best.side&&z.score>=best.score-8))return rejected('CONFLICT');
 // Avoid large opposing momentum; a sweep alone is not enough.
 if(best.side==='LONG'&&f.momentum4< -4)return rejected('OPPOSING_MOMENTUM');
 if(best.side==='SHORT'&&f.momentum4>4)return rejected('OPPOSING_MOMENTUM');
 const risk=Math.max(f.atr*1.5,f.price*.006);
 if(!finite(risk)||risk<=0||risk/f.price>.05)return rejected('EXCESSIVE_RISK');
 const sl=best.side==='LONG'?f.price-risk:f.price+risk;
 const tp=best.side==='LONG'?f.price+2*risk:f.price-2*risk;
 if(tp<=0)return rejected('INVALID_TARGET');
 // For range and reversal setups, do not place TP beyond the opposite
 // 20-bar boundary; for breakouts the historical boundary is not a cap.
 if(['RANGE_REVERSAL','LIQUIDITY_SWEEP','PUMP_EXHAUSTION','DUMP_EXHAUSTION'].includes(best.strategy)){
  const room=best.side==='LONG'?f.high20-f.price:f.price-f.low20;
  if(room<2*risk)return rejected('INSUFFICIENT_TARGET_ROOM');
 }
 return {signal:{symbol,side:best.side,strategy:best.strategy,score:best.score,reasons:best.reasons,entry:f.price,sl,tp,rr:2,bar:f.bar,detected:Date.now(),expiresAt:f.bar+900000+12*3600000,status:'OPEN',version:VERSION,regime,oiChange,funding,features:{rsi:f.rsi,volumeRatio:f.volumeRatio,atrPct:f.atrPct}},regime,features:f};
}
export function formatSignal(s){const pct=x=>((Math.abs(x/s.entry-1))*100).toFixed(2);return `🌪 VORTEX AI 5.0 | ${s.side==='LONG'?'🟢 LONG':'🔴 SHORT'}\n🪙 ${s.symbol} · 15m\n🧠 ${s.strategy} · ${s.regime}\n━━━━━━━━━━━━━━\n⚡ Оценка условий: ${s.score}/100 (не вероятность)\n📊 RSI: ${s.features.rsi.toFixed(1)} | Объём: x${s.features.volumeRatio.toFixed(1)}\n📈 OI: ${s.oiChange===null?'н/д':s.oiChange.toFixed(2)+'%'}\n━━━━━━━━━━━━━━\n💵 Цена сигнала: ${s.entry}\n🎯 TP: ${s.tp.toPrecision(7)} (${pct(s.tp)}%)\n🛑 SL: ${s.sl.toPrecision(7)} (${pct(s.sl)}%)\n⚖️ R:R 1:2 (до комиссий)\n━━━━━━━━━━━━━━\n${s.reasons.map(x=>'• '+x).join('\n')}\n⚠️ Информационный сигнал. Решение о сделке принимаешь самостоятельно.`;}

// Outcome tracking uses candles strictly AFTER the signal candle. A dual touch is ambiguous.
export function settleClosed(signal,candles,now=Date.now()){
 if(signal.status!=='OPEN')return signal;
 const expiry=signal.expiresAt||signal.bar+900000+12*3600000;
 for(const x of candles){if(x.t<=signal.bar||x.t+900000>now||x.t>=expiry)continue;
  const tp=signal.side==='LONG'?x.h>=signal.tp:x.l<=signal.tp;
  const sl=signal.side==='LONG'?x.l<=signal.sl:x.h>=signal.sl;
  if(tp||sl){signal.status=tp&&sl?'AMBIGUOUS':tp?'TP':'SL';signal.closedAt=x.t+900000;break;}
 }
 if(signal.status==='OPEN'&&now>=expiry){
  const requiredStart=signal.bar+900000;
  const available=candles.filter(x=>x.t>=requiredStart&&x.t<expiry&&x.t+900000<=now).sort((a,b)=>a.t-b.t);
  const expected=Math.ceil((expiry-requiredStart)/900000);
  if(available.length!==expected||available.some((x,i)=>x.t!==requiredStart+i*900000)){signal.status='UNVERIFIED';signal.closedAt=now;}
  else {signal.status='TIMEOUT';signal.closedAt=expiry;}
 }
 return signal;
}
export function oiChangeFromRows(rows,now=Date.now()){
 if(!Array.isArray(rows))return null;
 const c=rows.map(x=>({t:Number(x.timestamp),v:Number(x.openInterest)}))
  .filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.v)&&x.v>0&&x.t+900000<=now).sort((a,b)=>a.t-b.t);
 if(c.length<4||c.at(-1).t-c.at(-4).t!==3*900000||now-(c.at(-1).t+900000)>2*900000)return null;
 return (c.at(-1).v/c.at(-4).v-1)*100;
}
