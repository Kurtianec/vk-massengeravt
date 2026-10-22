import {NextResponse} from 'next/server';
import {authorized,redis,tg} from '../../../lib/core';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(req){
 if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const batches=[];for(let i=0;i<6;i++){const r=await redis(['GET',`vortex:last:${i}`]);if(r){try{batches.push(JSON.parse(r))}catch{}}}
  const entries=await redis(['HVALS','vortex:v7:signals']);
  const all=(entries||[]).map(x=>{try{return JSON.parse(x)}catch{return null}}).filter(Boolean).filter(x=>x.detected>Date.now()-30*86400000);
  // Active records are updated by the scanner; use outcome ledger to override initial OPEN state.
  const closedEntries=await redis(['HVALS','vortex:v7:outcomes']);
  const closed=new Map((closedEntries||[]).map(x=>{try{const s=JSON.parse(x);return [s.id,s]}catch{return [null,null]}}));
  const signals=all.map(s=>closed.get(s.id)||s);
  const count=status=>signals.filter(s=>s.status===status).length;
  const tp=count('TP'),sl=count('SL');
  const accuracy=tp+sl?`${(100*tp/(tp+sl)).toFixed(1)}%`:'нет данных';
  const sum=k=>batches.reduce((a,x)=>a+(Number(x[k])||0),0);
  const strategies=[...new Set(signals.map(s=>s.strategy).filter(Boolean))].sort();
  const breakdown=strategies.map(name=>{const rows=signals.filter(s=>s.strategy===name);const wins=rows.filter(s=>s.status==='TP').length,loss=rows.filter(s=>s.status==='SL').length;return `${({EARLY_IMPULSE:'Импульс',EARLY_PUMP:'Начало роста',EARLY_DUMP:'Начало падения',DONCHIAN_BREAKOUT:'Пробой диапазона',TREND_CONTINUATION:'Продолжение тренда',LIQUIDITY_SWEEP:'Ложный пробой',RANGE_REVERSAL:'Разворот в диапазоне',PUMP_EXHAUSTION:'Истощение роста',DUMP_EXHAUSTION:'Истощение падения'})[name]||name}: ${wins} целей / ${loss} стопов / ${rows.length-wins-loss} других`}).join('\n');
  const msg=`🌪 VORTEX AI 7.1 | Сводка\nСканирование: ${batches.length}/6\nПроверено монет: ${sum('checked')} | Ошибок: ${sum('errors')}\nНовых сигналов за последний цикл: ${sum('sent')}\n\n📊 Итоги за 30 дней\nВсего сигналов: ${signals.length}\nЦель достигнута: ${tp} | Стоп сработал: ${sl}\nЕщё открыто: ${count('OPEN')} | Без результата за 12 ч: ${count('TIMEOUT')}\nНеясный порядок касаний: ${count('AMBIGUOUS')} | Не удалось проверить: ${count('UNVERIFIED')}\nДоля целей среди проверенных TP/SL: ${accuracy}\n\n📋 По сценариям\n${breakdown||'Нет данных'}\n⚠️ Доля целей не равна доходности. Комиссии не учтены; неопределённые исходы исключены.`;
  await tg(msg);return NextResponse.json({ok:true,batches:batches.length,signals:signals.length});
 }catch(e){return NextResponse.json({ok:false,error:String(e.message)},{status:502})}
}
