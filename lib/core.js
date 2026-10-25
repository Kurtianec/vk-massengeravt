import {detect,shouldNotify,num} from './logic.js';
import {analyzeWhales} from './whales.js';
import {selectMarket} from './selection.js';
const BASE='https://api.bybit.com';
const batches=Math.max(1,Number(process.env.BATCHES||6));
const maxCoins=Math.max(1,Number(process.env.MAX_COINS||180));
const minTurnover=Number(process.env.MIN_TURNOVER_USDT||3000000);
const prefix=process.env.REDIS_PREFIX||'kurt-pd-v1';
const redisUrl=process.env.UPSTASH_REDIS_REST_URL;
const redisToken=process.env.UPSTASH_REDIS_REST_TOKEN;
function key(x){return `${prefix}:${x}`}
async function request(path){const r=await fetch(BASE+path,{signal:AbortSignal.timeout(8500),cache:'no-store'});if(!r.ok)throw Error(`Bybit HTTP ${r.status}`);const d=await r.json();if(d.retCode!==0)throw Error(`Bybit ${d.retCode}: ${d.retMsg}`);return d.result;}
async function redis(command){if(!redisUrl||!redisToken)throw Error('Upstash Redis not configured');const r=await fetch(redisUrl,{method:'POST',headers:{Authorization:`Bearer ${redisToken}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error(`Redis HTTP ${r.status}`);const d=await r.json();if(d.error)throw Error(`Redis ${d.error}`);return d.result;}
const get=async k=>{const s=await redis(['GET',key(k)]);return s?JSON.parse(s):null};
const put=async(k,v,seconds=86400)=>redis(['SET',key(k),JSON.stringify(v),'EX',seconds]);
const claim=async(k,seconds)=> (await redis(['SET',key(k),'1','NX','EX',seconds]))==='OK';
async function telegram(msg){const token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;if(!token||!chat)throw Error('Telegram not configured');const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chat,text:msg,disable_web_page_preview:true}),signal:AbortSignal.timeout(8000)});const d=await r.json();if(!d.ok)throw Error(`Telegram ${d.description||r.status}`);}
export function authorized(req){const secret=process.env.CRON_SECRET;return !!secret && req.headers.authorization===`Bearer ${secret}`;}
export async function scan(batch){
 if(!Number.isInteger(batch)||batch<0||batch>=batches)throw Error(`batch must be 0..${batches-1}`);
 const ts=Date.now();
 if(!(await claim(`batch-lock:${batch}:${Math.floor(ts/60000)}`,90))) return {ts,batch,skipped:true,reason:'batch_already_started_this_minute'};
 const market=await request('/v5/market/tickers?category=linear');
 const hotSize=Math.max(0,Number(process.env.HOT_COINS||30));
 const recentHot=(await redis(['ZREVRANGEBYSCORE',key('hot'),'+inf',String(ts-30*60*1000),'LIMIT',0,hotSize]))||[];
 const plan=selectMarket(market.list,{batch,batches,hotSize,discoverySize:Math.max(0,maxCoins-hotSize),minTurnover,now:ts,recentHot});
 const selected=plan.selected;
 let checked=0,alerts=0,whaleAlerts=0,errors=0; const examples=[];
 // Limit simultaneous outbound requests for Vercel functions.
 for(let i=0;i<selected.length;i+=5){await Promise.all(selected.slice(i,i+5).map(async ticker=>{
  try{
   const symbol=ticker.symbol;
   const raw=await request(`/v5/market/kline?category=linear&symbol=${encodeURIComponent(symbol)}&interval=1&limit=90`);
   const now=Date.now();
   const candles=raw.list.map(x=>({time:num(x[0]),open:num(x[1]),high:num(x[2]),low:num(x[3]),close:num(x[4]),volume:num(x[5])})).filter(x=>x.time+60000<=now).sort((a,b)=>a.time-b.time);
   const prev=await get(`state:${symbol}`);
   const result=detect(candles,ticker,prev,{minVolume:process.env.MIN_REL_VOLUME||2.5});
   checked++;
   const priorActive=prev?.stage && now-num(prev?.closedAt)<15*60000;
   const next={...result,stage:result.stage||(priorActive?prev.stage:null),direction:result.stage?result.direction:(priorActive?prev.direction:null),notifiedAt:prev?.notifiedAt||0,oi:num(ticker.openInterest)};
   if(result.stage && ['EARLY','CONFIRMED'].includes(result.stage)) {
    await redis(['ZADD',key('hot'),now,symbol]);
    await redis(['ZREMRANGEBYSCORE',key('hot'),'-inf',now-30*60*1000]);
   }
   if(shouldNotify(priorActive?prev:null,result,now) && await claim(`notify:${symbol}:${result.direction}:${result.stage}:${Math.floor(now/(30*60000))}`,1900)){
    const sign=result.direction==='PUMP'?'🚀':'📉';const title=result.stage==='EARLY'?'🟡 РАННЕЕ ДВИЖЕНИЕ':result.stage==='CONFIRMED'?'🟢 ПОДТВЕРЖДЕНО':'🔴 ВОЗМОЖНОЕ ИСТОЩЕНИЕ';
    const msg=`${sign} Crypto {Kurt} Ai | ${result.direction}\n${title}\n🪙 ${symbol}\n💵 Цена: ${result.price}\n⚡ 1м: ${result.ch1.toFixed(2)}% | 5м: ${result.ch5.toFixed(2)}% | 15м: ${result.ch15.toFixed(2)}%\n📊 Относительный объём: x${result.rv.toFixed(2)}\n🔥 Аномальность: x${result.anomaly.toFixed(2)}\n💰 OI с прошлого сканирования: ${result.oiChange===null?'нет данных':result.oiChange.toFixed(2)+'%'}\n🔎 Пробой диапазона: ${result.breakout?'да':'нет'}\n⚠️ Детектор движения, не торговый сигнал.`;
    await telegram(msg);alerts++;next.notifiedAt=now;examples.push(`${symbol}:${result.stage}`);
   }
   await put(`state:${symbol}`,next,3600);
   // Trade tape is a rolling sample, NOT complete history or wallet attribution.
   if(process.env.WHALE_ENABLED!=='false'){
    try{
     const tape=await request(`/v5/market/recent-trade?category=linear&symbol=${encodeURIComponent(symbol)}&limit=1000`);
     const trades=(tape.list||[]).map(t=>({id:String(t.execId||''),time:num(t.time),side:t.side,price:num(t.price),size:num(t.size)}));
     const prior=await get(`whale:${symbol}`);
     const w=analyzeWhales(trades,prior||{}, {minUsd:process.env.WHALE_MIN_TRADE_USD||100000});
     // First sample establishes a baseline; do not announce stale historical trades.
     if(prior){
      const big=w.events.sort((a,b)=>b.usd-a.usd).slice(0,3);
      if(big.length && await claim(`whale-notify:${symbol}:${big.map(t=>t.id||t.time).join(':')}`,3600)){
       const buys=big.filter(t=>t.side==='Buy').length,sells=big.length-buys;
       const fmt=n=>'$'+Math.round(n).toLocaleString('en-US');
       await telegram(`🐋 Crypto {Kurt} Ai | WHALE ACTIVITY\n🪙 ${symbol}\n💥 Новые крупные сделки: ${big.length}${w.events.length>3?' (показаны 3 крупнейшие)':''}\n🟢 Покупок: ${buys} | 🔴 Продаж: ${sells}\n💰 Крупнейшая: ${fmt(big[0].usd)} (${big[0].side==='Buy'?'агрессивная покупка':'агрессивная продажа'})\n📊 Выборка последних сделок: Buy ${fmt(w.buyUsd)} / Sell ${fmt(w.sellUsd)}\n⏱ Охват выборки: ${Math.round(w.coverageSeconds)} сек, ${w.sampleSize} сделок\n⚠️ Это биржевые исполнения, не идентифицированные кошельки. История между опросами может быть неполной.`);
       whaleAlerts++;
      }
     }
     await put(`whale:${symbol}`,{latestTime:w.latestTime,latestIds:w.latestIds},86400);
    }catch(e){errors++;if(examples.length<6)examples.push(`${symbol} whale: ${String(e.message).slice(0,60)}`)}
   }
  }catch(e){errors++;if(examples.length<6)examples.push(`${ticker.symbol}: ${String(e.message).slice(0,65)}`)}
 }));}
 const report={ts,batch,batches,eligible:plan.eligible,hot:plan.hot,discovery:plan.discovery,checked,alerts,whaleAlerts,errors,examples};
 await put(`batch:${batch}`,report,3600);
 // Per-batch counters avoid a non-atomic global increment.
 await redis(['INCRBY',key('alerts'),alerts]);await redis(['INCRBY',key('whaleAlerts'),whaleAlerts]);await redis(['INCRBY',key('errors'),errors]);
 return report;
}
export async function report(){
 const reports=await Promise.all(Array.from({length:batches},(_,i)=>get(`batch:${i}`)));
 const current=reports.filter(x=>x&&Date.now()-x.ts<15*60*1000);
 const checked=current.reduce((s,x)=>s+x.checked,0), alerts=current.reduce((s,x)=>s+x.alerts,0),errors=current.reduce((s,x)=>s+x.errors,0);
 const allAlerts=num(await redis(['GET',key('alerts')]));
 const allWhaleAlerts=num(await redis(['GET',key('whaleAlerts')]));
 const msg=`🚀 Crypto {Kurt} Ai | PUMP/DUMP отчёт\n🕒 ${new Date().toLocaleString('ru-RU',{timeZone:'Europe/Kyiv'})} (Киев)\n🔎 Свежие партии: ${current.length}/${batches}\n🪙 Проверено: ${checked}\n🚨 Уведомлений в партиях: ${alerts}\n⚠️ Ошибок: ${errors}\n📊 PUMP/DUMP уведомлений: ${allAlerts}\n🐋 WHALE уведомлений: ${allWhaleAlerts}\nℹ️ Показатели — обнаруженные движения, не прибыльность сделок.`;
 await telegram(msg);return {freshBatches:current.length,batches,checked,alerts,errors,allAlerts,allWhaleAlerts};
}
