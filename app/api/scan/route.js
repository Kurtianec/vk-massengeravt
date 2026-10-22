import {NextResponse} from 'next/server';
import {authorized,bybit,redis,tg} from '../../../lib/core';
import {candlesFromRows,createSignal,formatSignal,settleClosed,oiChangeFromRows,VERSION} from '../../../lib/advanced';
import {eventDecision} from '../../../lib/event-impact';
import {confirmEntry} from '../../../lib/decision';
import {settleMinute} from '../../../lib/outcomes';
import {hourTrendAllows} from '../../../lib/strict';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const INTERVAL=900000;
const threshold=Math.max(84,Math.min(100,Number(process.env.SIGNAL_THRESHOLD||86)));
const recentKey=(symbol)=>`vortex:v7:active:${symbol}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const verdict=(reason,candidate=0,sent=0)=>({checked:1,candidate,sent,reason});
const releaseLease=(key,token)=>redis(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",1,key,token]);
async function recordResult(signal){
 const raw=await redis(['GET',recentKey(signal.symbol)]);
 if(!raw)return;
 let old;try{old=JSON.parse(raw)}catch{return}
 if(!old||old.status!=='OPEN')return;
 const history=await bybit('/v5/market/kline',{category:'linear',symbol:signal.symbol,interval:'1',limit:1000});
 settleMinute(old,history.list);
 if(old.status!=='OPEN'){
  await redis(['SET',recentKey(signal.symbol),JSON.stringify(old),'EX',35*86400]);
  await redis(['HSET','vortex:v7:outcomes',old.id,JSON.stringify(old)]);
 }
}
async function scanOne(item){
 const symbol=item.symbol;
 // Avoid per-symbol funding calls on every cycle; current ticker already carries the funding rate.
 const [kl,oi]=await Promise.all([
  bybit('/v5/market/kline',{category:'linear',symbol,interval:'15',limit:400}),
  bybit('/v5/market/open-interest',{category:'linear',symbol,intervalTime:'15min',limit:12})
 ]);
 const candles=candlesFromRows(kl.list);
 const oiChange=oiChangeFromRows(oi.list);
 const funding=Number(item.fundingRate);
 const f=Number.isFinite(funding)?funding:null;
 // Settlement is handled by the independent /api/settle job.
 const {signal:setup}=createSignal(symbol,candles,oiChange,f,threshold);
 if(!setup)return verdict('NO_SETUP');
 const hourly=await bybit('/v5/market/kline',{category:'linear',symbol,interval:'60',limit:230});
 if(!hourTrendAllows(setup,hourly.list))return verdict('HOUR_TREND',1);
 // Expensive microstructure requests only for a qualified setup.
 const [minute,depth]=await Promise.all([
  bybit('/v5/market/kline',{category:'linear',symbol,interval:'1',limit:30}),
  bybit('/v5/market/orderbook',{category:'linear',symbol,limit:25})
 ]);
 const confirmation=confirmEntry(setup,minute.list,depth,item);
 if(!confirmation.allow)return verdict(confirmation.reason||'MINUTE_CONFIRMATION',1);
 const signal=confirmation.signal;
 signal.expiresAt=signal.confirmedAt+12*3600000;
 // News does not create trades; it can veto contradictory or already extended moves.
 const eventRaw=await redis(['GET',`vortex:v7:event:latest:${symbol}`]);
 if(eventRaw){let context;try{context=JSON.parse(eventRaw)}catch{}
  const decision=eventDecision(signal,context);
  if(!decision.allow)return verdict('NEWS_VETO',1);
  if(context?.impact?.status==='CONFIRMED_REACTION')signal.eventContext={type:context.event.type,status:context.impact.status,direction:context.impact.direction};
 }
 // One active position per symbol; avoid mutually contradictory alerts.
 const activeRaw=await redis(['GET',recentKey(symbol)]);
 if(activeRaw){try{const active=JSON.parse(activeRaw);if(active.status==='OPEN'&&Date.now()<(active.expiresAt||0))return verdict('ACTIVE_SIGNAL',1);}catch{}}
 const id=`${symbol}:${signal.side}:${signal.strategy}:${signal.bar}`;
 signal.id=id;
 const key=`vortex:v7:notification:${id}`;
 // An atomic claim prevents duplicates across overlapping cron requests.
 const claim=await redis(['SET',key,'SENDING','EX',600,'NX']);
 if(claim!=='OK')return verdict('DUPLICATE',1);
 try{
  // Persist the candidate before contacting a non-idempotent external API.
  await redis(['HSET','vortex:v7:signals',id,JSON.stringify({...signal,delivery:'PENDING'})]);
  await tg(formatSignal(signal));
  signal.deliveredAt=Date.now();
  await redis(['SET',key,'SENT','EX',35*86400]);
  await redis(['SET',recentKey(symbol),JSON.stringify(signal),'EX',35*86400]);
  await redis(['HSET','vortex:v7:signals',id,JSON.stringify({...signal,delivery:'SENT'})]);
  return verdict('SENT',1,1);
 }catch(e){
  // Releasing the short-lived claim enables retries. Telegram's non-idempotent API
  // means a network failure after successful delivery can still cause a duplicate.
  // A timeout can mean Telegram delivered the message. Preserve claim for inspection.
  await redis(['HSET','vortex:v7:delivery_errors',id,JSON.stringify({at:Date.now(),error:String(e.message).slice(0,200)})]).catch(()=>{});
  throw new Error(`DELIVERY: ${String(e.message).slice(0,160)}`);
 }
}
export async function GET(req){
 if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
 const batch=Number(new URL(req.url).searchParams.get('batch'));
 if(!Number.isInteger(batch)||batch<0||batch>5)return NextResponse.json({error:'batch 0..5 required'},{status:400});
 const lease=`vortex:v7:lease:${batch}`;let leaseOwned=false;const leaseToken=crypto.randomUUID();
 try{
  const locked=await redis(['SET',lease,leaseToken,'EX',240,'NX']);
  if(locked!=='OK')return NextResponse.json({ok:true,skipped:'batch already running',batch});
  leaseOwned=true;
  const tickers=await bybit('/v5/market/tickers',{category:'linear'});
  const all=(tickers.list||[]).filter(x=>x.symbol?.endsWith('USDT')&&Number(x.turnover24h)>1000000)
   .sort((a,b)=>Number(b.turnover24h)-Number(a.turnover24h)).slice(0,150);
  const items=all.slice(batch*25,batch*25+25);
  const result={version:VERSION,batch,selected:items.length,checked:0,candidates:0,sent:0,errors:[],reasons:{},startedAt:Date.now(),updated:Date.now()};
  let cursor=0;
  async function worker(){while(cursor<items.length){const item=items[cursor++];try{
   const r=await scanOne(item);result.checked+=r.checked;result.candidates+=r.candidate;result.sent+=r.sent;result.reasons[r.reason]=(result.reasons[r.reason]||0)+1;
  }catch(e){result.errors.push(`${item.symbol}: ${String(e.message).slice(0,180)}`);result.reasons.ERROR=(result.reasons.ERROR||0)+1}
  // Spread requests to reduce burst rate limiting.
  await sleep(90);
  }}
  await Promise.all(Array.from({length:3},()=>worker()));
  result.finishedAt=Date.now();
  await redis(['SET',`vortex:last:${batch}`,JSON.stringify({batch,startedAt:result.startedAt,finishedAt:result.finishedAt,updated:result.finishedAt,checked:result.checked,sent:result.sent,candidates:result.candidates,reasons:result.reasons,errors:result.errors.length,errorSamples:result.errors.slice(0,5)}),'EX',7*86400]);
  return NextResponse.json({...result,ok:result.checked>0,errors:result.errors.slice(0,10)},{status:result.checked>0?200:502});
 }catch(e){return NextResponse.json({ok:false,error:String(e.message)},{status:502})}
 finally{if(leaseOwned)await releaseLease(lease,leaseToken).catch(()=>{});}
}
