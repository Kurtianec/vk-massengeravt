import {NextResponse} from 'next/server';
import {authorized,bybit,redis,tg,analyze,marketEstimate,signalText,settle} from '../../../lib/core';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const threshold=Math.max(0,Math.min(100,Number(process.env.SIGNAL_THRESHOLD||65)));
export async function GET(req){if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});let batch=Number(new URL(req.url).searchParams.get('batch'));if(!Number.isInteger(batch)||batch<0||batch>5)return NextResponse.json({error:'batch 0..5 required'},{status:400});try{
 const ticker=await bybit('/v5/market/tickers',{category:'linear'});
 const all=ticker.list.filter(x=>x.symbol.endsWith('USDT')&&+x.turnover24h>0).sort((a,b)=>+b.turnover24h-+a.turnover24h).slice(0,150);
 const symbols=all.slice(batch*25,batch*25+25);if(!symbols.length)throw new Error('No symbols in batch');
 let state={};const raw=await redis(['GET',`vortex:batch:${batch}`]);if(raw)try{state=JSON.parse(raw)}catch{};
 let sent=0,checked=0,errors=[],candidates=0,closedCount=0;const signals=Array.isArray(state.signals)?state.signals:[];let idx=0;
 async function processOne(){while(idx<symbols.length){const item=symbols[idx++];try{
 const [kl,oi,fr]=await Promise.all([bybit('/v5/market/kline',{category:'linear',symbol:item.symbol,interval:'15',limit:800}),bybit('/v5/market/open-interest',{category:'linear',symbol:item.symbol,intervalTime:'15min',limit:20}),bybit('/v5/market/funding/history',{category:'linear',symbol:item.symbol,limit:1})]);
 const bars=kl.list||[];checked++;
 for(const prior of signals){if(prior.symbol===item.symbol&&prior.status==='OPEN'){const old=prior.status;settle(prior,bars);if(old==='OPEN'&&prior.status!=='OPEN')closedCount++}}
 const fresh=analyze(item.symbol,bars,oi.list||[],fr.list?.[0]?.fundingRate||'0');if(fresh.score>=threshold){candidates++;fresh.estimate=marketEstimate(bars,fresh);const last=signals.find(x=>x.symbol===fresh.symbol&&x.side===fresh.side&&x.bar===fresh.bar);const active=signals.find(x=>x.symbol===fresh.symbol&&x.side===fresh.side&&x.status==='OPEN');if(!last&&!active){await tg(signalText(fresh));signals.push(fresh);sent++;}}
 }catch(e){errors.push(`${item.symbol}: ${String(e.message).slice(0,100)}`)}}}
 await Promise.all(Array.from({length:5},()=>processOne()));
 const trimmed=signals.filter(x=>x.detected>Date.now()-30*86400000).slice(-500);
 await redis(['SET',`vortex:batch:${batch}`,JSON.stringify({signals:trimmed,updated:Date.now(),checked,sent,errors:errors.length})]);
 await redis(['SET',`vortex:last:${batch}`,JSON.stringify({updated:Date.now(),checked,sent,candidates,errors:errors.length,errorSamples:errors.slice(0,5),closed:closedCount,batch})]);
 return NextResponse.json({ok:checked>0,batch,selected:symbols.length,checked,signals:sent,candidates,closed:closedCount,errors:errors.slice(0,8)},{status:checked===0?502:200});
 }catch(e){return NextResponse.json({ok:false,error:String(e.message||e)},{status:502})}}
