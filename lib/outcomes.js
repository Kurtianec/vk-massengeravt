// Conservative settlement with one-minute candles strictly after detection.
// Gaps produce UNVERIFIED rather than a false TP/SL or timeout.
export function settleMinute(signal,rows,now=Date.now()){
 if(signal.status!=='OPEN')return signal;
 const expiry=signal.expiresAt;
 const start=Math.ceil((signal.confirmedAt||signal.detected)/60000)*60000;
 const end=Math.min(expiry,Math.floor(now/60000)*60000);
 const candles=(rows||[]).map(r=>({t:+r[0],h:+r[2],l:+r[3]})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.h)&&Number.isFinite(x.l)&&x.t>=start&&x.t<end).sort((a,b)=>a.t-b.t);
 let expected=start;
 for(const x of candles){
  if(x.t!==expected){signal.status='UNVERIFIED';signal.closedAt=now;signal.outcomeReason='MISSING_MINUTE_CANDLE';return signal;}
  expected+=60000;
  const tp=signal.side==='LONG'?x.h>=signal.tp:x.l<=signal.tp;
  const sl=signal.side==='LONG'?x.l<=signal.sl:x.h>=signal.sl;
  if(tp||sl){signal.status=tp&&sl?'AMBIGUOUS':tp?'TP':'SL';signal.closedAt=x.t+60000;return signal;}
 }
 if(now>=expiry){signal.status=expected>=expiry?'TIMEOUT':'UNVERIFIED';signal.closedAt=now;}
 return signal;
}
