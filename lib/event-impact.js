// Event impact is a measured reaction, not a forecast. No news-only trading signals.
export const EVENT_RULES=[
 {type:'DELISTING',direction:'SHORT',severity:'HIGH',rx:/\b(delist(?:ing|ed|s)?|remove(?:s|d)? from (?:spot|futures|trading)|trading (?:will be )?terminat(?:ed|ion))\b/i},
 {type:'EXPLOIT',direction:'SHORT',severity:'HIGH',rx:/\b(hack(?:ed)?|exploit(?:ed)?|security breach|funds stolen|drain(?:ed)?|protocol attack)\b/i},
 {type:'NETWORK_HALT',direction:'SHORT',severity:'HIGH',rx:/\b(network halt(?:ed)?|chain halt(?:ed)?|blockchain stoppage|withdrawals suspend(?:ed)?)\b/i},
 {type:'LISTING',direction:'LONG',severity:'MEDIUM',rx:/\b(list(?:ing|ed|s)? on (?:binance|bybit|coinbase|upbit|okx)|(?:binance|bybit|coinbase|upbit|okx) (?:to )?list(?:s|ed)?)\b/i},
 {type:'UNLOCK',direction:'SHORT',severity:'MEDIUM',rx:/\b(token unlock|vesting unlock|unlocks? \d+ (?:million|billion)|supply unlock)\b/i},
 {type:'APPROVAL',direction:'LONG',severity:'MEDIUM',rx:/\b(etf approval|etf approved|regulatory approval|sec approves)\b/i},
 {type:'PARTNERSHIP',direction:null,severity:'LOW',rx:/\b(partnership|partners with|collaboration)\b/i}
];
export function classifyEvent(title){
 if(typeof title!=='string')return null;
 const rule=EVENT_RULES.find(x=>x.rx.test(title));
 return rule?{type:rule.type,direction:rule.direction,severity:rule.severity}:null;
}
export function reactionFromCandles(rows,published,now=Date.now()){
 if(!Number.isFinite(published)||published>now||now-published>3*3600000)return {valid:false,reason:'STALE_OR_FUTURE_EVENT'};
 const k=(rows||[]).map(r=>({t:+r[0],c:+r[4],v:+r[5]})).filter(x=>Number.isFinite(x.t)&&x.c>0&&x.v>=0&&x.t+60000<=now).sort((a,b)=>a.t-b.t);
 const before=k.filter(x=>x.t+60000<=published).at(-1);
 const after=k.filter(x=>x.t>=published&&x.t+60000<=now);
 if(!before||after.length<3||after[0].t-published>120000)return {valid:false,reason:'INSUFFICIENT_POST_EVENT_DATA'};
 if(after.some((x,i)=>i&&x.t-after[i-1].t!==60000))return {valid:false,reason:'CANDLE_GAP'};
 const base=k.filter(x=>x.t+60000<=published).slice(-30);
 if(base.length<10)return {valid:false,reason:'NO_VOLUME_BASELINE'};
 const avg=base.reduce((s,x)=>s+x.v,0)/base.length;
 const observed=after.slice(0,Math.min(15,after.length));
 const movePct=(observed.at(-1).c/before.c-1)*100;
 const volumeRatio=observed.reduce((s,x)=>s+x.v,0)/observed.length/Math.max(avg,1e-9);
 return {valid:true,movePct,volumeRatio,minutes:observed.length,asOf:observed.at(-1).t+60000};
}
export function assessImpact(event,reaction){
 if(!event||!reaction?.valid)return {status:'UNVERIFIED',direction:null,reason:reaction?.reason||'UNKNOWN_EVENT'};
 const direction=reaction.movePct>=0?'LONG':'SHORT';
 if(Math.abs(reaction.movePct)<0.6||reaction.volumeRatio<1.5)return {status:'UNCONFIRMED',direction:null,reason:'NO_SIGNIFICANT_REACTION'};
 if(event.direction&&direction!==event.direction)return {status:'CONTRADICTORY',direction:null,reason:'PRICE_OPPOSES_HEADLINE'};
 if(Math.abs(reaction.movePct)>12)return {status:'LATE_MOVE',direction:null,reason:'PRICE_ALREADY_EXTENDED'};
 return {status:'CONFIRMED_REACTION',direction,reason:'PRICE_AND_VOLUME_CONFIRM',movePct:reaction.movePct,volumeRatio:reaction.volumeRatio};
}
export function eventDecision(signal,eventContext,now=Date.now()){
 if(!signal||!eventContext||!Number.isFinite(eventContext.published)||now-eventContext.published>2*3600000||eventContext.published>now)return {allow:true,reason:'NO_RECENT_EVENT'};
 if(eventContext.impact?.status==='LATE_MOVE')return {allow:false,reason:'EVENT_MOVE_ALREADY_EXTENDED'};
 if(eventContext.impact?.status==='CONFIRMED_REACTION'&&eventContext.impact.direction!==signal.side)return {allow:false,reason:'EVENT_OPPOSES_SIGNAL'};
 return {allow:true,reason:eventContext.impact?.status||'EVENT_NOT_CONFIRMED'};
}
