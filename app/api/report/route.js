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
  const reasonLabels={NO_SETUP:'Нет подходящей ситуации на 15м',HOUR_TREND:'Не совпал часовой тренд',INSUFFICIENT_MINUTE_HISTORY:'Мало минутных свечей',MINUTE_GAPS:'Пропуски минутных свечей',STALE_MINUTE_DATA:'Устаревшие минутные данные',INVALID_QUOTE:'Некорректные цены',WIDE_SPREAD:'Слишком широкий спред',INVALID_RISK:'Некорректный риск',LATE_ENTRY:'Вход уже запоздал',MINUTE_TREND_OPPOSES_LONG:'Минутный тренд против покупки',MINUTE_TREND_OPPOSES_SHORT:'Минутный тренд против продажи',FADING_VOLUME:'Недостаточная активность',INSUFFICIENT_BOOK:'Недостаточно данных стакана',INVALID_BOOK:'Некорректный стакан',BOOK_HEAVILY_OPPOSES_LONG:'Стакан против покупки',BOOK_HEAVILY_OPPOSES_SHORT:'Стакан против продажи',TARGET_ALREADY_PASSED:'Цель уже пройдена',NEWS_VETO:'Новостной фильтр',ACTIVE_SIGNAL:'По монете уже есть открытый сигнал',DUPLICATE:'Повторный сигнал',SENT:'Сигнал отправлен',ERROR:'Ошибка запроса'};
  const reasons={};for(const b of batches)for(const [k,v] of Object.entries(b.reasons||{}))reasons[k]=(reasons[k]||0)+Number(v||0);
  const reasonLines=Object.entries(reasons).filter(([k,v])=>k!=='SENT'&&v>0).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`• ${reasonLabels[k]||k}: ${v}`).join('\n');
  const timeFmt=t=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Kyiv',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(t);
  const times=batches.filter(b=>b.finishedAt||b.updated).map(b=>b.finishedAt||b.updated);
  const windowText=times.length?`${timeFmt(Math.min(...times))} — ${timeFmt(Math.max(...times))} (Киев)`:'нет данных';
  const diagnostics=`\n\n🔎 Проверка фильтров\nВремя: ${windowText}\nПотенциальных входов: ${sum('candidates')}\nОтсеяно: ${Math.max(0,sum('checked')-sum('sent')-sum('errors'))}\n${reasonLines||'Подробности появятся после обновления всех 6 заданий'}${batches.some(b=>!b.reasons)?'\n⚠️ Часть заданий ещё не содержит диагностику.':''}`;
  const msg=`🌪 VORTEX AI 7.2 | Сводка\nСканирование: ${batches.length}/6\nПроверено монет: ${sum('checked')} | Ошибок: ${sum('errors')}\nНовых сигналов за последний цикл: ${sum('sent')}\n\n📊 Итоги за 30 дней\nВсего сигналов: ${signals.length}\nЦель достигнута: ${tp} | Стоп сработал: ${sl}\nЕщё открыто: ${count('OPEN')} | Без результата за 12 ч: ${count('TIMEOUT')}\nНеясный порядок касаний: ${count('AMBIGUOUS')} | Не удалось проверить: ${count('UNVERIFIED')}\nДоля целей среди проверенных TP/SL: ${accuracy}\n\n📋 По сценариям\n${breakdown||'Нет данных'}${diagnostics}\n⚠️ Доля целей не равна доходности. Комиссии не учтены; неопределённые исходы исключены.`;
  await tg(msg);return NextResponse.json({ok:true,batches:batches.length,signals:signals.length});
 }catch(e){return NextResponse.json({ok:false,error:String(e.message)},{status:502})}
}
