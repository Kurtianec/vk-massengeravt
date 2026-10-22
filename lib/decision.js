// Secondary confirmation of a closed 15m setup using CLOSED 1m candles and a live orderbook.
// Neither orderbook snapshots nor headline sentiment alone predict future returns.
export function confirmEntry(signal, rows, book, ticker, now=Date.now()) {
  const reject=(reason)=>({allow:false,reason});
  if(!signal||!Array.isArray(rows))return reject('MISSING_DATA');
  const minute=rows.map(r=>({t:+r[0],o:+r[1],h:+r[2],l:+r[3],c:+r[4],v:+r[5]}))
    .filter(x=>[x.t,x.o,x.h,x.l,x.c,x.v].every(Number.isFinite)&&x.t+60000<=now)
    .sort((a,b)=>a.t-b.t);
  if(minute.length<12)return reject('INSUFFICIENT_MINUTE_HISTORY');
  const recent=minute.slice(-12);
  if(recent.some((x,i)=>i>0&&x.t-recent[i-1].t!==60000))return reject('MINUTE_GAPS');
  if(now-(recent.at(-1).t+60000)>180000)return reject('STALE_MINUTE_DATA');
  const last=recent.at(-1);
  const entry=Number(ticker?.lastPrice);
  const bid=Number(ticker?.bid1Price),ask=Number(ticker?.ask1Price);
  if(!(entry>0&&bid>0&&ask>=bid))return reject('INVALID_QUOTE');
  const spread=(ask-bid)/entry*100;
  if(spread>.18)return reject('WIDE_SPREAD');
  const risk=Math.abs(signal.entry-signal.sl);
  if(!(risk>0))return reject('INVALID_RISK');
  const gap=Math.abs(entry-signal.entry);
  if(gap>risk*.22)return reject('LATE_ENTRY');
  // Short-term trend and volume must not contradict the higher timeframe setup.
  const prev=recent.slice(0,-3);
  const baseline=prev.reduce((s,x)=>s+x.v,0)/prev.length;
  const tail=recent.slice(-3);
  const volume=tail.reduce((s,x)=>s+x.v,0)/3/Math.max(baseline,1e-9);
  const momentum=last.c/recent.at(-5).c-1;
  if(signal.side==='LONG'&&(momentum<-.006||last.c<recent.at(-4).c*.994))return reject('MINUTE_TREND_OPPOSES_LONG');
  if(signal.side==='SHORT'&&(momentum>.006||last.c>recent.at(-4).c*1.006))return reject('MINUTE_TREND_OPPOSES_SHORT');
  if(volume<.45)return reject('FADING_VOLUME');
  // The depth ratio is a *snapshot*, not evidence of executed market buys/sells.
  const bids=book?.b||book?.bids||[],asks=book?.a||book?.asks||[];
  if(!Array.isArray(bids)||!Array.isArray(asks)||bids.length<5||asks.length<5)return reject('INSUFFICIENT_BOOK');
  const depth=a=>a.slice(0,10).reduce((s,z)=>s+Number(z[0])*Number(z[1]),0);
  const b=depth(bids),a=depth(asks);
  if(!(b>0&&a>0))return reject('INVALID_BOOK');
  const imbalance=b/(a+b);
  if(signal.side==='LONG'&&imbalance<.27)return reject('BOOK_HEAVILY_OPPOSES_LONG');
  if(signal.side==='SHORT'&&imbalance>.73)return reject('BOOK_HEAVILY_OPPOSES_SHORT');
  const next={...signal,entry,sl:signal.side==='LONG'?entry-risk:entry+risk,
    tp:signal.side==='LONG'?entry+2*risk:entry-2*risk,
    features:{...signal.features,spreadPct:spread,depthImbalance:imbalance,minuteVolumeRatio:volume},
    confirmedAt:now,confirmation:'1m+spread+depth'};
  return {allow:true,signal:next,metrics:{spreadPct:spread,depthImbalance:imbalance,volumeRatio:volume}};
}
