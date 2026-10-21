import {NextResponse} from 'next/server';
import {authorized,bybit,redis,tg} from '../../../lib/core';
import {candlesFromRows,createSignal,formatSignal,settleClosed,oiChangeFromRows,VERSION} from '../../../lib/advanced';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const INTERVAL=900000;
const threshold=Math.max(0,Math.min(100,Number(process.env.SIGNAL_THRESHOLD||70)));
const recentKey=(symbol)=>`vortex:v5:active:${symbol}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const releaseLease=(key,token)=>redis(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",1,key,token]);
async function recordResult(signal,candles){
 const raw=await redis(['GET',recentKey(signal.symbol)]);
 if(!raw)return;
 let old;try{old=JSON.parse(raw)}catch{return}
 if(!old||old.status!=='OPEN')return;
 settleClosed(old,candles);
 if(old.status!=='OPEN'){
  await redis(['SET',recentKey(signal.symbol),JSON.stringify(old),'EX',35*86400]);
  await redis(['HSET','vortex:v5:outcomes',old.id,JSON.stringify(old)]);
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
 await recordResult({symbol},candles);
 const {signal}=createSignal(symbol,candles,oiChange,f,threshold);
 if(!signal)return {checked:1,candidate:0,sent:0};
 const id=`${symbol}:${signal.side}:${signal.strategy}:${signal.bar}`;
 signal.id=id;
 const key=`vortex:v5:notification:${id}`;
 // An atomic claim prevents duplicates across overlapping cron requests.
 const claim=await redis(['SET',key,'SENDING','EX',600,'NX']);
 if(claim!=='OK')return {checked:1,candidate:1,sent:0};
 try{
  // Persist the candidate before contacting a non-idempotent external API.
  await redis(['HSET','vortex:v5:signals',id,JSON.stringify({...signal,delivery:'PENDING'})]);
  await tg(formatSignal(signal));
  await redis(['SET',key,'SENT','EX',35*86400]);
  await redis(['SET',recentKey(symbol),JSON.stringify(signal),'EX',35*86400]);
  await redis(['HSET','vortex:v5:signals',id,JSON.stringify({...signal,delivery:'SENT'})]);
  return {checked:1,candidate:1,sent:1};
 }catch(e){
  // Releasing the short-lived claim enables retries. Telegram's non-idempotent API
  // means a network failure after successful delivery can still cause a duplicate.
  // A timeout can mean Telegram delivered the message. Preserve claim for inspection.
  await redis(['HSET','vortex:v5:delivery_errors',id,JSON.stringify({at:Date.now(),error:String(e.message).slice(0,200)})]).catch(()=>{});
  throw new Error(`DELIVERY: ${String(e.message).slice(0,160)}`);
 }
}
export async function GET(req){
 if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
 const batch=Number(new URL(req.url).searchParams.get('batch'));
 if(!Number.isInteger(batch)||batch<0||batch>5)return NextResponse.json({error:'batch 0..5 required'},{status:400});
 const lease=`vortex:v5:lease:${batch}`;let leaseOwned=false;const leaseToken=crypto.randomUUID();
 try{
  const locked=await redis(['SET',lease,leaseToken,'EX',240,'NX']);
  if(locked!=='OK')return NextResponse.json({ok:true,skipped:'batch already running',batch});
  leaseOwned=true;
  const tickers=await bybit('/v5/market/tickers',{category:'linear'});
  const all=(tickers.list||[]).filter(x=>x.symbol?.endsWith('USDT')&&Number(x.turnover24h)>0)
   .sort((a,b)=>Number(b.turnover24h)-Number(a.turnover24h)).slice(0,150);
  const items=all.slice(batch*25,batch*25+25);
  const result={version:VERSION,batch,selected:items.length,checked:0,candidates:0,sent:0,errors:[],updated:Date.now()};
  let cursor=0;
  async function worker(){while(cursor<items.length){const item=items[cursor++];try{
   const r=await scanOne(item);result.checked+=r.checked;result.candidates+=r.candidate;result.sent+=r.sent;
  }catch(e){result.errors.push(`${item.symbol}: ${String(e.message).slice(0,180)}`)}
  // Spread requests to reduce burst rate limiting.
  await sleep(90);
  }}
  await Promise.all(Array.from({length:3},()=>worker()));
  await redis(['SET',`vortex:last:${batch}`,JSON.stringify({batch,updated:result.updated,checked:result.checked,sent:result.sent,candidates:result.candidates,errors:result.errors.length,errorSamples:result.errors.slice(0,5)}),'EX',7*86400]);
  return NextResponse.json({...result,ok:result.checked>0,errors:result.errors.slice(0,10)},{status:result.checked>0?200:502});
 }catch(e){return NextResponse.json({ok:false,error:String(e.message)},{status:502})}
 finally{if(leaseOwned)await releaseLease(lease,leaseToken).catch(()=>{});}
}
