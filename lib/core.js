const BASE='https://api.bybit.com';
export function authorized(req){const secret=process.env.CRON_SECRET;return !!secret && req.headers.get('x-cron-secret')===secret;}
export async function bybit(path, params={}){let url=new URL(BASE+path);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(13000)});if(!r.ok)throw new Error(`Bybit HTTP ${r.status} on ${path}`);const j=await r.json();if(j.retCode!==0)throw new Error(`Bybit ${j.retCode}: ${j.retMsg}`);return j.result;}
export async function redis(cmd){const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;if(!url||!token)throw new Error('Missing Upstash credentials');const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(cmd),cache:'no-store'});if(!r.ok)throw new Error(`Redis HTTP ${r.status}`);const j=await r.json();if(j.error)throw new Error(`Redis: ${j.error}`);return j.result;}
export async function tg(message){const bot=process.env.TELEGRAM_BOT_TOKEN,id=process.env.TELEGRAM_CHAT_ID;if(!bot||!id)throw new Error('Missing Telegram credentials');const r=await fetch(`https://api.telegram.org/bot${bot}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:id,text:message,disable_web_page_preview:true})});const j=await r.json();if(!j.ok)throw new Error('Telegram rejected message');}
export function ema(arr,n){if(arr.length<n)return null;let e=arr.slice(0,n).reduce((a,b)=>a+b,0)/n;for(let i=n;i<arr.length;i++)e=arr[i]*2/(n+1)+e*(1-2/(n+1));return e;}
export function rsi(closes,n=14){if(closes.length<n+1)return 50;let gains=0,loss=0;for(let i=1;i<=n;i++){let d=closes[i]-closes[i-1];gains+=Math.max(d,0);loss+=Math.max(-d,0)}gains/=n;loss/=n;for(let i=n+1;i<closes.length;i++){let d=closes[i]-closes[i-1];gains=(gains*(n-1)+Math.max(d,0))/n;loss=(loss*(n-1)+Math.max(-d,0))/n;}return loss===0?(gains===0?50:100):100-100/(1+gains/loss);}
export function stochRsi(c){let a=[];for(let i=15;i<=c.length;i++)a.push(rsi(c.slice(0,i)));if(a.length<14)return 50;let w=a.slice(-14),lo=Math.min(...w),hi=Math.max(...w);return hi===lo?50:(a.at(-1)-lo)/(hi-lo)*100;}
export function fmt(n){if(!Number.isFinite(n))return '?';return n>=1?n.toFixed(4):n>=.01?n.toFixed(5):n.toFixed(7);}
export function analyze(symbol,rows,oi,funding){const k=rows.map(x=>({t:Number(x[0]),o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5]})).sort((a,b)=>a.t-b.t);const now=Date.now();const closed=k.filter(x=>x.t+900000<=now);if(closed.length<55)throw new Error('Insufficient closed candles');const candles=closed.slice(-55),last=candles.at(-1),c=candles.map(x=>x.c),R=rsi(c),S=stochRsi(c),avgVol=candles.slice(-21,-1).reduce((a,x)=>a+x.v,0)/20,volRatio=last.v/Math.max(avgVol,.000001);const highs=candles.slice(-31,-1).map(x=>x.h),lows=candles.slice(-31,-1).map(x=>x.l),res=Math.max(...highs),sup=Math.min(...lows);const e20=ema(c,20),e50=ema(c,50);const oiSorted=oi.map(x=>({t:+x.timestamp,v:+x.openInterest})).sort((a,b)=>a.t-b.t);const oiClosed=oiSorted.filter(x=>x.t+900000<=now);let oiChange=null;if(oiClosed.length>=4&&oiClosed.at(-1).v>0&&oiClosed.at(-4).v>0)oiChange=(oiClosed.at(-1).v/oiClosed.at(-4).v-1)*100;let long=0,short=0,lr=[],sr=[];
if(R<35){long+=22;lr.push(`RSI ${R.toFixed(1)} низкий`)}if(R>65){short+=22;sr.push(`RSI ${R.toFixed(1)} высокий`)}if(S<20){long+=17;lr.push('Stoch RSI в перепроданности')}if(S>80){short+=17;sr.push('Stoch RSI в перекупленности')}
if(last.c>e20&&e20>e50){long+=18;lr.push('Цена выше EMA20/50')}if(last.c<e20&&e20<e50){short+=18;sr.push('Цена ниже EMA20/50')}
if(last.c>last.o){long+=10;lr.push('Положительная закрытая свеча')}else{short+=10;sr.push('Отрицательная закрытая свеча')}
if(volRatio>1.5){if(last.c>last.o){long+=14;lr.push(`Объём x${volRatio.toFixed(1)}`)}else{short+=14;sr.push(`Объём x${volRatio.toFixed(1)}`)}}
if(oiChange!==null){if(oiChange>2){if(last.c>last.o){long+=12;lr.push(`OI +${oiChange.toFixed(1)}%`)}else{short+=12;sr.push(`OI +${oiChange.toFixed(1)}%`)}}if(oiChange< -2){long+=4;short+=4;lr.push('OI сокращается');sr.push('OI сокращается')}}
const f=Number(funding);if(Number.isFinite(f)){if(f<-.0005){long+=5;lr.push('Отрицательный funding — риск шорт-сквиза')}if(f>.0005){short+=5;sr.push('Положительный funding — риск лонг-сквиза')}}
const side=long>short?'LONG':'SHORT',score=Math.min(100,Math.max(long,short)),reasons=side==='LONG'?lr:sr,entry=last.c;const vol=Math.max((Math.max(...candles.slice(-15).map(x=>x.h))-Math.min(...candles.slice(-15).map(x=>x.l)))/4,entry*.007);let sl,tp;if(side==='LONG'){sl=Math.min(sup,entry-vol);tp=Math.max(res,entry+vol*1.8)}else{sl=Math.max(res,entry+vol);tp=Math.min(sup,entry-vol*1.8)}return {symbol,side,score,reasons,entry,tp,sl,sup,res,oiChange,funding:f,bar:last.t,detected:Date.now(),status:'OPEN'};}
// Historical conditional estimate for THIS instrument, using only past closed candles.
// This is a heuristic empirical estimate, not a calibrated real-world probability.
function candleFeatures(candles, index){
  const prior=candles.slice(0,index+1);
  if(prior.length<55)return null;
  const closes=prior.map(x=>x.c),last=prior.at(-1);
  const e20=ema(closes,20),e50=ema(closes,50);
  const avg=prior.slice(-21,-1).reduce((a,x)=>a+x.v,0)/20;
  return {r:rsi(closes),s:stochRsi(closes),trend:Math.sign(e20-e50),priceTrend:Math.sign(last.c-e20),
    vol:Math.min(5,last.v/Math.max(avg,1e-12)),mom:(last.c/closes.at(-5)-1)*100,
    price:last.c};
}
export function marketEstimate(rows,signal){
  const candles=rows.map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5]}))
    .sort((a,b)=>a.t-b.t).filter(x=>x.t+900000<=Date.now());
  const horizon=48; // 12 hours of closed 15-minute candles
  if(candles.length<300)return {pct:null,samples:0,reason:'Недостаточно истории свечей'};
  const current=candleFeatures(candles,candles.length-1);
  if(!current)return {pct:null,samples:0,reason:'Недостаточно данных индикаторов'};
  const tpDistance=Math.abs(signal.tp/signal.entry-1);
  const slDistance=Math.abs(signal.sl/signal.entry-1);
  if(tpDistance<=0||slDistance<=0||tpDistance>.5||slDistance>.5)return {pct:null,samples:0,reason:'Некорректные TP/SL'};
  let samples=[];
  // Exclude recent bars without a full 12-hour future window; stride prevents heavy overlapping samples.
  for(let i=65;i<candles.length-horizon-1;i+=8){
    const f=candleFeatures(candles,i);
    if(!f||!Number.isFinite(f.r)||!Number.isFinite(f.s))continue;
    const distance=Math.abs(f.r-current.r)/18+Math.abs(f.s-current.s)/34+
      Math.abs(f.mom-current.mom)/3+Math.min(3,Math.abs(f.vol-current.vol))/2+
      (f.trend!==current.trend?1.3:0)+(f.priceTrend!==current.priceTrend?.9:0);
    if(distance>3.5)continue;
    let outcome='TIMEOUT';
    const pt=f.price;
    const take=signal.side==='LONG'?pt*(1+tpDistance):pt*(1-tpDistance);
    const stop=signal.side==='LONG'?pt*(1-slDistance):pt*(1+slDistance);
    for(let j=i+1;j<=i+horizon;j++){
      const x=candles[j],hitTp=signal.side==='LONG'?x.h>=take:x.l<=take;
      const hitSl=signal.side==='LONG'?x.l<=stop:x.h>=stop;
      if(hitTp&&hitSl){outcome='AMBIGUOUS';break}
      if(hitTp){outcome='TP';break}
      if(hitSl){outcome='SL';break}
    }
    samples.push({distance,outcome});
  }
  samples.sort((a,b)=>a.distance-b.distance);
  const nearest=samples.slice(0,35).filter(x=>x.outcome!=='AMBIGUOUS');
  const n=nearest.length;
  if(n<15)return {pct:null,samples:n,reason:'Мало похожих ситуаций за доступную историю'};
  // Laplace smoothing prevents unjustified 0% or 100%.
  const wins=nearest.filter(x=>x.outcome==='TP').length;
  const pct=Math.round(100*(wins+1)/(n+2));
  return {pct,samples:n,wins,method:'Похожие состояния RSI/Stoch RSI, тренда, объёма и импульса; TP раньше SL за 12 ч',
    caveat:'Оценка по историческим аналогам, не гарантированная вероятность'};
}
export function signalText(s){
const pct=s.estimate?.pct;
const prob=pct===null||pct===undefined?'Недостаточно похожих данных':`${pct}% (историческая оценка, ${s.estimate.samples} аналогов)`;
const upside=(Math.abs(s.tp/s.entry-1)*100).toFixed(2);
const downside=(Math.abs(s.sl/s.entry-1)*100).toFixed(2);
const clean=(t)=>String(t).replace(/[<>]/g,'');
return `◈ VORTEX AI | ${s.side==='LONG'?'🟢 LONG':'🔴 SHORT'}
🪙 ${s.symbol} | Bybit · 15м
━━━━━━━━━━━━━━━━━━━━
⚡ Сила сигнала: ${s.score}/100
🎯 Шанс достижения TP до SL за 12 ч: ${prob}
━━━━━━━━━━━━━━━━━━━━
💰 ТОРГОВЫЙ ПЛАН
💵 Цена: ${fmt(s.entry)}
✅ TP: ${fmt(s.tp)} (+${upside}% в сторону сделки)
🛑 SL: ${fmt(s.sl)} (−${downside}%)
🧱 Поддержка: ${fmt(s.sup)}
🚧 Сопротивление: ${fmt(s.res)}
━━━━━━━━━━━━━━━━━━━━
🧠 ПОЧЕМУ ${s.side}?
${s.reasons.map(x=>'✅ '+clean(x)).join('\n')}
📈 OI за 45 мин: ${s.oiChange===null?'нет данных':s.oiChange.toFixed(1)+'%'}
⚠️ Риск: возможны ложные пробои и сквизы.
📌 Оценка основана на истории монеты, не является гарантией и не учитывает комиссии.`;
}
export function settle(s,rows){if(s.status!=='OPEN')return s;const candles=rows.map(x=>({t:+x[0],h:+x[2],l:+x[3]})).filter(x=>x.t>s.bar&&x.t+900000<=Date.now()).sort((a,b)=>a.t-b.t);for(const x of candles){if(x.t>s.detected+12*3600000)break;const hitTp=s.side==='LONG'?x.h>=s.tp:x.l<=s.tp,hitSl=s.side==='LONG'?x.l<=s.sl:x.h>=s.sl;if(hitTp&&hitSl){s.status='AMBIGUOUS';break}if(hitTp){s.status='TP';break}if(hitSl){s.status='SL';break}}if(s.status==='OPEN'&&Date.now()>s.detected+12*3600000)s.status='TIMEOUT';return s;}
