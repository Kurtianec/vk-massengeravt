import {NextResponse} from 'next/server';
import {authorized,redis,tg} from '../../../lib/core';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(req){
 if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const batches=[];for(let i=0;i<6;i++){const r=await redis(['GET',`vortex:last:${i}`]);if(r){try{batches.push(JSON.parse(r))}catch{}}}
  const entries=await redis(['HVALS','vortex:v5:signals']);
  const all=(entries||[]).map(x=>{try{return JSON.parse(x)}catch{return null}}).filter(Boolean).filter(x=>x.detected>Date.now()-30*86400000);
  // Active records are updated by the scanner; use outcome ledger to override initial OPEN state.
  const closedEntries=await redis(['HVALS','vortex:v5:outcomes']);
  const closed=new Map((closedEntries||[]).map(x=>{try{const s=JSON.parse(x);return [s.id,s]}catch{return [null,null]}}));
  const signals=all.map(s=>closed.get(s.id)||s);
  const count=status=>signals.filter(s=>s.status===status).length;
  const tp=count('TP'),sl=count('SL');
  const accuracy=tp+sl?`${(100*tp/(tp+sl)).toFixed(1)}%`:'нет данных';
  const sum=k=>batches.reduce((a,x)=>a+(Number(x[k])||0),0);
  const msg=`🌪 VORTEX AI 5.0 | Отчёт\nПартии: ${batches.length}/6\nПроверено: ${sum('checked')} | Ошибок: ${sum('errors')}\nОтправлено: ${sum('sent')}\n\n📊 За 30 дней\nСигналов: ${signals.length}\nTP: ${tp} | SL: ${sl}\nОткрыто: ${count('OPEN')} | Тайм-аут: ${count('TIMEOUT')}\nНеоднозначные: ${count('AMBIGUOUS')} | Непроверенные: ${count('UNVERIFIED')}\nTP/(TP+SL): ${accuracy}\n⚠️ Без комиссий, неоднозначные и тайм-ауты исключены из точности.`;
  await tg(msg);return NextResponse.json({ok:true,batches:batches.length,signals:signals.length});
 }catch(e){return NextResponse.json({ok:false,error:String(e.message)},{status:502})}
}
