import {NextResponse} from 'next/server';
import {authorized,bybit,redis,tg} from '../../../lib/core';
import {parseRss,matchNews} from '../../../lib/news';
import {classifyEvent,reactionFromCandles,assessImpact} from '../../../lib/event-impact';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(req){
 if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const source=process.env.NEWS_RSS_URL||'https://cointelegraph.com/rss';
  if(!/^https:\/\/(cointelegraph\.com|www\.coindesk\.com|decrypt\.co|cryptoslate\.com)\//.test(source))return NextResponse.json({error:'RSS source not allowed'},{status:400});
  const response=await fetch(source,{cache:'no-store',signal:AbortSignal.timeout(8500),headers:{'User-Agent':'VortexAI/6.0 news watcher'}});
  if(!response.ok)throw Error(`RSS HTTP ${response.status}`);
  const xml=await response.text();const news=parseRss(xml);
  const market=await bybit('/v5/market/tickers',{category:'linear'});
  const symbols=(market.list||[]).filter(x=>x.symbol?.endsWith('USDT')).map(x=>x.symbol);
  let sent=0,analyzed=0,errors=0;
  for(const article of news){
   const matches=matchNews(article,symbols);const event=classifyEvent(article.title);
   if(!event||!matches.length)continue;
   for(const symbol of matches.slice(0,2)){
    const key=`vortex:v7:event:seen:${symbol}:${Buffer.from(article.url).toString('base64url').slice(0,150)}`;
    if(await redis(['EXISTS',key]))continue;
    try{
     const candles=await bybit('/v5/market/kline',{category:'linear',symbol,interval:'1',limit:200});
     const reaction=reactionFromCandles(candles.list,article.published);
     const impact=assessImpact(event,reaction);
     const record={symbol,title:article.title,url:article.url,published:article.published,event,impact,reaction,checkedAt:Date.now()};
     // Never persist an unverified article as a directional trading signal.
     await redis(['SET',`vortex:v7:event:latest:${symbol}`,JSON.stringify(record),'EX',7200]);
     await redis(['SET',key,'1','EX',172800]);analyzed++;
     const message=`📰 VORTEX AI 7.0 | EVENT IMPACT\n🪙 ${symbol}\n📌 ${event.type} (${event.severity})\n🗞 ${article.title}\n📉 Реакция: ${reaction.valid?reaction.movePct.toFixed(2)+'%':'недостаточно данных'}\n📊 Объём: ${reaction.valid?'x'+reaction.volumeRatio.toFixed(2):'н/д'}\n🔎 ${impact.status}\n⚠️ Анализ события, НЕ сигнал на вход.\n${article.url}`;
     await tg(message);sent++;
     if(sent>=6)break;
    }catch(e){errors++;}
   }
   if(sent>=6)break;
  }
  return NextResponse.json({ok:true,seen:news.length,analyzed,sent,errors});
 }catch(e){return NextResponse.json({ok:false,error:String(e.message)},{status:502})}
}
