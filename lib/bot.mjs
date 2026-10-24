import {evaluate,settleCandle} from './core.mjs';
const BYBIT='https://api.bybit.com/v5/market';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MINUTE=60000;
export function isFreshCandle(candleTime, now=Date.now()){return Number.isFinite(candleTime)&&now>=candleTime+15*MINUTE&&now-candleTime<=31*MINUTE;}
export function reportCycle(entries,now=Date.now()){
 const recent=entries.filter(x=>x&&Number.isInteger(x.cycle)&&Number.isInteger(x.batch)&&x.at<=now&&now-x.at<90*MINUTE);
 const cycles=[...new Set(recent.map(x=>x.cycle))].sort((a,b)=>b-a);
 const complete=cycles.find(c=>new Set(recent.filter(x=>x.cycle===c).map(x=>x.batch)).size===6);
 const selected=complete??cycles[0];
 return selected===undefined?[]:recent.filter(x=>x.cycle===selected).sort((a,b)=>a.batch-b.batch);
}
export function scanCycle(now=Date.now()){return Math.floor(now/(15*MINUTE));}
export function validQuote(bid,ask){return Number.isFinite(bid)&&Number.isFinite(ask)&&bid>0&&ask>0&&ask>=bid;}
export function eligibleMinute(t,c){return c.t>=Math.ceil(t.createdAt/MINUTE)*MINUTE&&c.t+MINUTE<=Date.now();}
export async function bybit(path,params={}){const u=new URL(BYBIT+path);for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));const res=await fetch(u,{signal:AbortSignal.timeout(12000),cache:'no-store'});if(!res.ok)throw Error(`Bybit HTTP ${res.status}`);const j=await res.json();if(j.retCode!==0)throw Error(`Bybit ${j.retCode}: ${j.retMsg}`);return j.result}
export async function redis(cmd,...args){const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;if(!url||!token)throw Error('Missing Upstash configuration');const r=await fetch(url.replace(/\/$/,'') ,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify([cmd,...args]),cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(`Redis HTTP ${r.status}`);const j=await r.json();if(j.error)throw Error(j.error);return j.result}
export async function telegram(text){const token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;if(!token||!chat)throw Error('Missing Telegram configuration');const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chat,text,disable_web_page_preview:true}),signal:AbortSignal.timeout(12000)});const j=await r.json();if(!j.ok)throw Error(`Telegram: ${j.description}`)}
export function authorize(req){const s=process.env.CRON_SECRET;return !!s&&req.headers.get('authorization')===`Bearer ${s}`}
const format=n=>Number(n).toPrecision(7).replace(/\.?0+$/,'');
export function signalText(s){return `🚀 Crypto {Kurt} Ai | ${s.side==='LONG'?'🟢 LONG':'🔴 SHORT'}\n🪙 ${s.symbol} | 15m\n💰 Вход: ${format(s.entry)}\n🎯 TP1: ${format(s.tp1)}\n🎯 TP2: ${format(s.tp2)}\n🛑 SL: ${format(s.sl)}\n📊 RSI: ${s.rsi} | OI: +${s.oiChange}% | Объём: x${s.volumeRatio}\n⭐ Оценка условий: ${s.score}/100 (не вероятность прибыли)\n⚠️ Не финансовая рекомендация`}
export async function symbols(){const data=await bybit('/tickers',{category:'linear'});return data.list.filter(x=>x.symbol.endsWith('USDT')&&Number(x.turnover24h)>=10000000).sort((a,b)=>Number(b.turnover24h)-Number(a.turnover24h)).slice(0,150).map(x=>x.symbol)}
function parseKlines(list){return list.map(x=>({t:Number(x[0]),o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5]})).sort((a,b)=>a.t-b.t).filter(c=>c.t+15*60000<=Date.now())}
export async function analyze(symbol){const [kl,oi,ticker]=await Promise.all([bybit('/kline',{category:'linear',symbol,interval:'15',limit:65}),bybit('/open-interest',{category:'linear',symbol,intervalTime:'15min',limit:5}),bybit('/tickers',{category:'linear',symbol})]);const candles=parseKlines(kl.list),o=oi.list.slice().sort((a,b)=>+a.timestamp-+b.timestamp),last=+o.at(-1)?.openInterest,base=+o.at(-4)?.openInterest;if(!base||!last)return null;const recent=candles.at(-1);if(!recent||!isFreshCandle(recent.t))return null;const past=candles.slice(-21,-1),avg=past.reduce((a,c)=>a+c.v,0)/past.length;const tk=ticker.list?.[0];if(!tk)return null;const bid=Number(tk.bid1Price),ask=Number(tk.ask1Price);if(!validQuote(bid,ask)||!Number.isFinite(avg)||avg<=0||!Number.isFinite(recent.v)||recent.v<=0||candles.some(c=>![c.o,c.h,c.l,c.c,c.v].every(Number.isFinite)||c.o<=0||c.h<=0||c.l<=0||c.c<=0||c.v<0))return null;const spreadPct=(ask-bid)/((ask+bid)/2)*100;return evaluate({symbol,candles,oiChange:(last/base-1)*100,volumeRatio:recent.v/avg,spreadPct})}
export async function scanBatch(batch){
 const cycle=scanCycle();
 const list=await symbols(),slice=list.filter((_,i)=>i%6===batch);let checked=0,sent=0,errors=0;
 // Up to five symbols in parallel: faster without an unbounded request burst.
 async function processSymbol(sym){
  try{
   const s=await analyze(sym);checked++;if(!s)return;
   const key=`ck:claim:${s.symbol}:${s.side}:${s.candleTime}`;
   const claim=await redis('SET',key,'1','EX',172800,'NX');if(claim!=='OK')return;
   const id=`${s.symbol}:${s.side}:${s.candleTime}`;
   const trade={...s,id,createdAt:Date.now(),lastChecked:Date.now(),status:'PENDING',hit1:false};
   // Keep the claim on uncertain Telegram failures: retrying can duplicate a delivered message.
   // PENDING trades are excluded from results and settlement until delivery is confirmed.
   try{
    await redis('SET',`ck:trade:${id}`,JSON.stringify(trade),'EX',60*60*24*35);
    await telegram(signalText(s));
    trade.createdAt=Date.now();trade.lastChecked=trade.createdAt;trade.status='OPEN';
    await redis('SET',`ck:trade:${id}`,JSON.stringify(trade),'EX',60*60*24*35);
    await redis('ZADD','ck:ids',trade.createdAt,id);
    sent++;
   }catch(e){console.error('Signal delivery or persistence uncertain; claim retained',id,e.message);throw e}

  }catch(e){errors++;console.error(sym,e.message)}
 }
 for(let i=0;i<slice.length;i+=5)await Promise.all(slice.slice(i,i+5).map(processSymbol));
 await redis('HSET',`ck:scan:${cycle}`,`batch${batch}`,JSON.stringify({batch,at:Date.now(),cycle,checked,sent,errors}));
 await redis('EXPIRE',`ck:scan:${cycle}`,7200);
 return {batch,checked,sent,errors,cycle}
}
export async function settleTrades(){
 const ids=await redis('ZRANGEBYSCORE','ck:ids',Date.now()-30*86400000,'+inf');
 const all=ids||[];if(!all.length)return {checked:0,updated:0,errors:0,remaining:0};
 // Rotate through open trades, rather than repeatedly checking only the first N.
 const cursor=Number(await redis('INCR','ck:settle:cursor'));
 const selected=Array.from({length:Math.min(12,all.length)},(_,i)=>all[((cursor-1)*12+i)%all.length]);
 let checked=0,updated=0,errors=0;
 async function process(id){
  try{
   const raw=await redis('GET',`ck:trade:${id}`);if(!raw)return;
   let t=JSON.parse(raw);if(!['OPEN','TP1_OPEN'].includes(t.status))return;
   const first=Math.ceil(t.createdAt/MINUTE)*MINUTE;
   let start=Math.max(first,Math.floor(t.lastChecked/MINUTE)*MINUTE);
   let changed=false;
   // Up to three consecutive pages per trade; a long outage is caught up over subsequent runs.
   for(let page=0;page<3;page++){
    const end=Math.min(Math.floor(Date.now()/MINUTE)*MINUTE-2*MINUTE,start+179*MINUTE);
    if(end<start)break;
    const result=await bybit('/kline',{category:'linear',symbol:t.symbol,interval:'1',start,end,limit:200});
    const ordered=(result.list||[]).map(x=>({t:+x[0],h:+x[2],l:+x[3]})).sort((a,b)=>a.t-b.t);
    let expected=start;
    for(const c of ordered){
     if(c.t<expected)continue;
     if(c.t!==expected||!eligibleMinute(t,c))break;
     t=settleCandle(t,c);t.lastChecked=c.t+MINUTE;expected+=MINUTE;changed=true;
     if(!['OPEN','TP1_OPEN'].includes(t.status))break;
    }
    if(expected===start||!['OPEN','TP1_OPEN'].includes(t.status))break;
    start=expected;
   }
   checked++;
   if(changed){await redis('SET',`ck:trade:${id}`,JSON.stringify(t),'EX',60*60*24*35);updated++}
  }catch(e){errors++;console.error('settle',id,e.message)}
 }
 for(let i=0;i<selected.length;i+=3)await Promise.all(selected.slice(i,i+3).map(process));
 return {checked,updated,errors,remaining:Math.max(0,all.length-selected.length)};
}
export async function report(){const since=Date.now()-30*86400000;const ids=await redis('ZRANGEBYSCORE','ck:ids',since,'+inf');const stats={TP2:0,TP1_SL:0,SL:0,AMBIGUOUS:0,OPEN:0,TP1_OPEN:0,LONG:0,SHORT:0};for(const id of ids||[]){const raw=await redis('GET',`ck:trade:${id}`);if(!raw)continue;const t=JSON.parse(raw);if(t.status==='PENDING')continue;stats[t.status]=(stats[t.status]||0)+1;stats[t.side]++}const current=scanCycle();const candidates=await Promise.all(Array.from({length:7},(_,i)=>redis('HGETALL',`ck:scan:${current-i}`)));
 const entries=candidates.flatMap(rows=>Object.values(rows||{}).map(v=>{try{return JSON.parse(v)}catch{return null}})).filter(Boolean);
 const fresh=reportCycle(entries);const sum=k=>fresh.reduce((a,x)=>a+x[k],0);const closed=stats.TP2+stats.TP1_SL+stats.SL;const rate=closed?(100*stats.TP2/closed).toFixed(1)+'%':'нет данных';const msg=`🚀 Crypto {Kurt} Ai | Отчёт\n🕒 ${new Date().toLocaleString('ru-RU',{timeZone:'Europe/Kyiv'})} (Киев)\n🔍 Сканирование (последний цикл): ${fresh.length}/6 партий (цикл ${fresh[0]?.cycle??'нет данных'})\n🪙 Проверено: ${sum('checked')} | 📨 Сигналов: ${sum('sent')} | ⚠️ Ошибок: ${sum('errors')}\n\n📊 За 30 дней: ${(ids||[]).length} сигналов\n🏆 TP2: ${stats.TP2}\n🟡 TP1, ещё открыт: ${stats.TP1_OPEN}\n🟠 TP1 → SL: ${stats.TP1_SL}\n🔴 SL: ${stats.SL}\n❓ Неоднозначные: ${stats.AMBIGUOUS}\n⏳ Открыто: ${stats.OPEN}\n🟢 LONG: ${stats.LONG} | 🔴 SHORT: ${stats.SHORT}\n📈 TP2 / (TP2 + SL + TP1→SL): ${rate}\n⚠️ Без комиссий; TP1 не считается полной победой.`;await telegram(msg);return {stats,scans:fresh.length}}
