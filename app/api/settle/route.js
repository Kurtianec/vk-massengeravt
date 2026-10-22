import {NextResponse} from 'next/server';
import {authorized,bybit,redis} from '../../../lib/core';
import {settleMinute} from '../../../lib/outcomes';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const activeKey=s=>`vortex:v7:active:${s}`;
export async function GET(req){
 if(!authorized(req))return NextResponse.json({error:'Нет доступа'},{status:401});
 const u=new URL(req.url),batch=Number(u.searchParams.get('batch')||0);
 if(!Number.isInteger(batch)||batch<0||batch>5)return NextResponse.json({error:'batch: 0..5'},{status:400});
 try{
  const entries=await redis(['HVALS','vortex:v7:signals']);
  const outcomes=await redis(['HKEYS','vortex:v7:outcomes']);
  const done=new Set(outcomes||[]);
  const open=(entries||[]).map(v=>{try{return JSON.parse(v)}catch{return null}})
   .filter(s=>s&&s.id&&s.delivery==='SENT'&&s.status==='OPEN'&&!done.has(s.id))
   .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const selected=open.filter((_,i)=>i%6===batch);
  let checked=0,closed=0;const errors=[];
  for(const s of selected){
   try{
    const lease=`vortex:v7:settlelock:${s.id}`;
    const locked=await redis(['SET',lease,'1','NX','EX',90]);if(locked!=='OK')continue;
    try{
     // Up to 1000 minutes of history, 12h horizon; overdue older records become UNVERIFIED.
     if(Date.now()-(s.deliveredAt||s.confirmedAt||s.detected)>1000*60000){
      s.status='UNVERIFIED';s.closedAt=Date.now();s.outcomeReason='HISTORY_WINDOW_EXPIRED';
     }else{
      const k=await bybit('/v5/market/kline',{category:'linear',symbol:s.symbol,interval:'1',limit:1000});
      settleMinute(s,k.list);
     }
     checked++;
     if(s.status!=='OPEN'){
      await redis(['HSET','vortex:v7:outcomes',s.id,JSON.stringify(s)]);
      await redis(['SET',activeKey(s.symbol),JSON.stringify(s),'EX',35*86400]);closed++;
     }
    }finally{await redis(['DEL',lease]).catch(()=>{});}
   }catch(e){errors.push(`${s.symbol}: ${String(e.message).slice(0,110)}`);}
  }
  return NextResponse.json({ok:true,batch,open:open.length,selected:selected.length,checked,closed,errors:errors.slice(0,10)});
 }catch(e){return NextResponse.json({ok:false,error:String(e.message)},{status:502});}
}
